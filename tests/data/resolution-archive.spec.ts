import { expect, test } from "@playwright/test";
import {
  normalizeResolutionArchive,
  parseResolutionReturnTo,
  readMockResolutionArchive,
  readResolutionArchive,
  resolutionArchiveHref,
} from "../../lib/legislative/resolution-archive";
import type { ContentFetch } from "../../lib/content/supabase";
import type { LegislativeDocument } from "../../types";

const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
};
function row(index: number, additions: Record<string, unknown> = {}) {
  return {
    id: `resolution-${String(index).padStart(3, "0")}`,
    number: `${index}-2026`,
    title: `Community resolution ${index}`,
    date_approved: "2026-11-09",
    year: 2026,
    author: "Legacy Author",
    co_author: "Legacy Coauthor",
    status: "Approved",
    approval_mode: "authored",
    term_id: "current-term",
    content_scope: "legislative",
    published: true,
    summary: "Unused full text",
    pdf_url: "/documents/unused.pdf",
    ...additions,
  };
}
function fixture(rows: Record<string, unknown>[], cap = 500) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const request: ContentFetch = async (url, init) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, init });
    const params = parsed.searchParams;
    let matching = rows.filter(
      (r) =>
        r.published === true &&
        r.content_scope === "legislative" &&
        (params.get("term_id") === "is.null"
          ? r.term_id == null
          : r.term_id === params.get("term_id")?.slice(3)) &&
        (!params.has("year") ||
          String(r.year) === params.get("year")?.slice(3)),
    );
    const search = params.get("author_match.name");
    if (search) {
      const regex = new RegExp(search.slice("imatch.".length), "i");
      matching = matching.filter((r) =>
        [
          r.number,
          r.title,
          ...(r.approval_mode === "mass_motion"
            ? params.get("or")!.includes("approval_mode.eq.mass_motion")
              ? ["Mass motion"]
              : []
            : [
                r.author_id
                  ? (r.author_record as { name?: string })?.name || ""
                  : r.author,
                r.co_author_id
                  ? (r.co_author_record as { name?: string })?.name || ""
                  : r.author_id
                    ? ""
                    : r.co_author || "",
              ]),
        ].some((value) => regex.test(String(value))),
      );
    }
    matching.sort(
      params.get("select") === "year"
        ? (a, b) =>
            Number(b.year) - Number(a.year) ||
            String(a.id).localeCompare(String(b.id))
        : (a, b) =>
            String(b.date_approved).localeCompare(String(a.date_approved)) ||
            String(a.id).localeCompare(String(b.id)),
    );
    const offset = Number(params.get("offset"));
    const limit = Math.min(cap, Number(params.get("limit")));
    if (offset >= matching.length && offset > 0)
      return Response.json(
        { code: "PGRST103" },
        { status: 416, headers: { "content-range": `*/${matching.length}` } },
      );
    const page = matching.slice(offset, offset + limit);
    return Response.json(
      params.get("select") === "year"
        ? page.map((r) => ({ year: r.year }))
        : page,
      {
        headers: {
          "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${matching.length}`,
        },
      },
    );
  };
  return { calls, request };
}

test("archive paginates only after term/year/search, keeps exact totals and sends a slim DTO", async () => {
  const rows = Array.from({ length: 65 }, (_, i) => row(i));
  rows.push(
    row(66, { term_id: "past-term" }),
    row(67, { published: false }),
    row(68, { content_scope: "executive" }),
    row(69, { year: 2025 }),
  );
  const source = fixture(rows);
  const result = await readResolutionArchive(
    { term: "current-term", year: "2026", page: "2" },
    config,
    source.request,
  );
  expect(result).toMatchObject({
    total: 65,
    page: 2,
    pageSize: 25,
    years: [2026, 2025],
    query: "",
    year: "2026",
  });
  expect(result.documents.map((d) => d.id)).toEqual(
    rows.slice(25, 50).map((r) => r.id),
  );
  expect(Object.keys(result.documents[0]).sort()).toEqual(
    [
      "approvalMode",
      "author",
      "coAuthor",
      "dateApproved",
      "id",
      "number",
      "status",
      "title",
      "year",
    ].sort(),
  );
  for (const { url, init } of source.calls) {
    expect(url.searchParams.get("published")).toBe("eq.true");
    expect(url.searchParams.get("term_id")).toBe("eq.current-term");
    expect(url.searchParams.get("content_scope")).toBe("eq.legislative");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toMatchObject({
      Prefer: "count=exact",
      apikey: config.key,
    });
    for (const field of [
      "summary",
      "pdf_url",
      "committee",
      "session",
      "office_id",
      "is_sample",
    ])
      expect(url.searchParams.get("select")).not.toContain(field);
  }
  const pageCall = source.calls.find(
    ({ url }) => url.searchParams.get("select") !== "year",
  )!.url.searchParams;
  expect(pageCall.get("offset")).toBe("25");
  expect(pageCall.get("limit")).toBe("25");
  expect(pageCall.get("year")).toBe("eq.2026");
  expect(pageCall.get("order")).toBe("date_approved.desc,id.asc");
});

test("search finds later-page numbers and joined author/coauthor names without loading officials separately", async () => {
  const rows = Array.from({ length: 60 }, (_, i) => row(i));
  rows[59] = row(59, {
    author_id: "registered-author",
    co_author_id: "registered-coauthor",
    author: "Stale Hidden Text",
    co_author: "Stale Coauthor",
    author_record: { name: "Hon. Richard M. Canillo" },
    co_author_record: { name: "Hon. Lorenzo P. Niñal" },
  });
  for (const query of ["59-2026", "Richard", "Niñal"]) {
    const source = fixture(rows);
    const result = await readResolutionArchive(
      { term: "current-term", q: query },
      config,
      source.request,
    );
    expect(result.total).toBe(1);
    expect(result.documents[0]).toMatchObject({
      id: "resolution-059",
      author: "Hon. Richard M. Canillo",
      coAuthor: "Hon. Lorenzo P. Niñal",
    });
    expect(source.calls).toHaveLength(2);
    expect(
      source.calls.every(({ url }) => url.pathname === "/rest/v1/resolutions"),
    ).toBe(true);
    const search = source.calls.find(({ url }) => url.searchParams.has("or"))!
      .url.searchParams;
    expect(search.get("select")).toContain(
      "author_match:officials!author_id(),coauthor_match:officials!co_author_id()",
    );
    expect(search.get("author_match.name")).toBe(
      search.get("coauthor_match.name"),
    );
    expect(search.get("or")).toContain(
      "author_match.not.is.null,coauthor_match.not.is.null",
    );
  }
  expect(
    (
      await readResolutionArchive(
        { term: "current-term", q: "Stale Hidden" },
        config,
        fixture(rows).request,
      )
    ).total,
  ).toBe(0);
  expect(
    (
      await readResolutionArchive(
        { term: "current-term", q: "Legacy Coauthor" },
        config,
        fixture(rows).request,
      )
    ).total,
  ).toBe(59);
});

test("literal wildcard and PostgREST punctuation search cannot broaden the predicate", async () => {
  const queries = [
    "%",
    "_",
    "*",
    "(budget),or(title.eq.anything)",
    'Quotation " and \\ slash',
    "[fund]+?.^$|{2}",
  ];
  for (const q of queries) {
    const source = fixture([
      row(1, { title: `Literal ${q} ending` }),
      row(2, { title: "Other title with no punctuation" }),
    ]);
    const result = await readResolutionArchive(
      { term: "current-term", q },
      config,
      source.request,
    );
    expect(result.documents.map((d) => d.id)).toEqual(["resolution-001"]);
    const params = source.calls.find(({ url }) => url.searchParams.has("or"))!
      .url.searchParams;
    expect(params.get("or")).toContain('number.imatch."');
    expect(params.get("published")).toBe("eq.true");
    expect(params.getAll("or")).toHaveLength(1);
  }
});

test("Mass motion matches its visible approval label and excludes hidden legacy authors", async () => {
  const rows = [
    row(1, {
      approval_mode: "mass_motion",
      author: "Hidden author",
      co_author: "Hidden coauthor",
    }),
    row(2),
  ];
  for (const q of ["Mass motion", "mass", "motion", "s m"]) {
    const result = await readResolutionArchive(
      { term: "current-term", q },
      config,
      fixture(rows).request,
    );
    expect(result.documents.map((d) => d.id)).toEqual(["resolution-001"]);
  }
  expect(
    (
      await readResolutionArchive(
        { term: "current-term", q: "Hidden author" },
        config,
        fixture(rows).request,
      )
    ).total,
  ).toBe(0);
});

test("small server row caps still fill pages and year options; out-of-range pages clamp safely", async () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(i));
  const capped = fixture(rows, 3);
  const first = await readResolutionArchive(
    { term: "current-term" },
    config,
    capped.request,
  );
  expect(first.documents).toHaveLength(25);
  expect(first.total).toBe(30);
  expect(first.years).toEqual([2026]);
  const source = fixture(rows);
  const last = await readResolutionArchive(
    { term: "current-term", page: "999" },
    config,
    source.request,
  );
  expect(last.page).toBe(2);
  expect(last.documents).toHaveLength(5);
  expect(last.total).toBe(30);
  expect(
    source.calls.some(({ url }) => url.searchParams.get("offset") === "25"),
  ).toBe(true);
  expect(
    await readResolutionArchive(
      { term: "current-term", q: "no match", page: "999" },
      config,
      fixture(rows).request,
    ),
  ).toMatchObject({ documents: [], total: 0, page: 1 });
});

test("unassigned terms use SQL null and invalid/no-current terms make no request", async () => {
  const source = fixture([row(1, { term_id: null }), row(2)]);
  expect(
    (
      await readResolutionArchive(
        { term: "unassigned" },
        config,
        source.request,
      )
    ).total,
  ).toBe(1);
  expect(
    source.calls.every(
      ({ url }) => url.searchParams.get("term_id") === "is.null",
    ),
  ).toBe(true);
  for (const term of ["none", "", "bad&term=anything", "../current"]) {
    const invalid = fixture([]);
    expect(
      (await readResolutionArchive({ term }, config, invalid.request)).total,
    ).toBe(0);
    expect(invalid.calls).toHaveLength(0);
  }
});

test("fresh public reads expose corrections and unpublishing; failures never fall back to samples", async () => {
  const rows = [row(1)];
  const source = fixture(rows);
  expect(
    (
      await readResolutionArchive(
        { term: "current-term" },
        config,
        source.request,
      )
    ).documents[0].title,
  ).toBe("Community resolution 1");
  rows[0].title = "Corrected resolution";
  expect(
    (
      await readResolutionArchive(
        { term: "current-term" },
        config,
        source.request,
      )
    ).documents[0].title,
  ).toBe("Corrected resolution");
  rows[0].published = false;
  expect(
    (
      await readResolutionArchive(
        { term: "current-term" },
        config,
        source.request,
      )
    ).total,
  ).toBe(0);
  await expect(
    readResolutionArchive(
      { term: "current-term" },
      config,
      async () => new Response("Unavailable", { status: 503 }),
    ),
  ).rejects.toThrow("HTTP 503");
  await expect(
    readResolutionArchive({ term: "current-term" }, config, async () =>
      Response.json([]),
    ),
  ).rejects.toThrow("accurate result count");
  await expect(
    readResolutionArchive({ term: "current-term" }, config, async () => {
      throw new Error("Offline");
    }),
  ).rejects.toThrow("Could not reach");
});

test("archive URLs preserve only canonical public term/year/query/page state", () => {
  const href = resolutionArchiveHref({
    term: "current-term",
    year: "2026",
    q: "  budget & works  ",
    page: "2",
  });
  expect(parseResolutionReturnTo(href)).toBe(href);
  expect(new URL(href, "https://example.test").searchParams.get("q")).toBe(
    "budget & works",
  );
  for (const value of [
    undefined,
    "https://other.test/legislative/resolutions?term=current-term",
    "//other.test",
    "/admin?term=current-term",
    "/legislative/resolutions?term=current-term&preview=true",
    "/legislative/resolutions?term=current-term#outside",
    "/legislative/resolutions?term=../outside",
  ])
    expect(parseResolutionReturnTo(value)).toBe("/legislative/resolutions");
  expect(
    normalizeResolutionArchive({
      term: "current-term",
      year: "NaN",
      q: "\u0000 test\n query ",
      page: "-20",
    }),
  ).toEqual({
    term: "current-term",
    year: "all",
    query: "test  query",
    page: 1,
  });
});

test("explicit mock reads preserve pagination, term/year filters and literal searching", () => {
  const documents: LegislativeDocument[] = Array.from(
    { length: 31 },
    (_, index) => ({
      id: `mock-${index}`,
      number: `${index}-2026`,
      title: `Community ${index}`,
      dateApproved: "2026-11-09",
      year: 2026,
      author: "Council Member",
      status: "Approved",
      summary: "Private to full detail",
      termId: "current-term",
    }),
  );
  expect(
    readMockResolutionArchive({ term: "current-term", page: "2" }, documents),
  ).toMatchObject({ total: 31, page: 2, pageSize: 25 });
  expect(
    readMockResolutionArchive({ term: "current-term", q: "30-2026" }, documents)
      .total,
  ).toBe(1);
  expect(
    readMockResolutionArchive({ term: "current-term", q: "*" }, documents)
      .total,
  ).toBe(0);
  expect(
    readMockResolutionArchive({ term: "past-term" }, documents).total,
  ).toBe(0);
});
