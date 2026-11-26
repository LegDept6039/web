import { expect, test } from "@playwright/test";
import {
  loadSession,
  loadSessionRecords,
} from "../../lib/legislative/session-records";
import {
  readSupabaseCollection,
  type ContentFilters,
} from "../../lib/content/supabase";
import type { Collection, Collections } from "../../lib/content/schema";
import type {
  LegislativeDocument,
  MunicipalDocument,
  Session,
} from "../../types";

const session: Session = {
  id: "61st-regular",
  number: "61st",
  name: "61st Regular Session",
  type: "Regular session",
  date: "2026-09-28",
  officeId: "legislative-office",
  termId: "current-term",
  contentScope: "legislative",
  description: "Council proceedings.",
  agenda: ["Committee reports"],
  image: "/images/news/council.svg",
};
const ordinance: LegislativeDocument = {
  id: "water-safety",
  number: "116-2026",
  title: "Community water safety",
  dateApproved: session.date,
  year: 2026,
  author: "Council Member",
  status: "Approved",
  summary: "Water safety standards.",
  sessionId: session.id,
  officeId: session.officeId,
  termId: session.termId,
  contentScope: "legislative",
};
const agenda: MunicipalDocument = {
  id: "session-agenda",
  title: "Session agenda",
  description: "Order of business.",
  date: "2026-09-25",
  sessionId: session.id,
  officeId: session.officeId,
  termId: session.termId,
  contentScope: "legislative",
  documentType: "agenda",
  fileUrl: "/documents/sample-legislative-document.pdf",
};
type Rows = Partial<{ [K in Collection]: Collections[K][] }>;
function reader(
  rows: Rows,
  calls: {
    collection: Collection;
    filters?: ContentFilters;
    limit?: number;
  }[] = [],
) {
  return async <K extends Collection>(
    collection: K,
    filters?: ContentFilters,
    limit?: number,
  ): Promise<Collections[K][]> => {
    calls.push({ collection, filters, limit });
    return (rows[collection] || []) as Collections[K][];
  };
}

test("session lookup targets one published ID, preserves sample metadata and rejects foreign scope", async () => {
  const calls: {
    collection: Collection;
    filters?: ContentFilters;
    limit?: number;
  }[] = [];
  expect(
    await loadSession(session.id, reader({ sessions: [session] }, calls)),
  ).toEqual(session);
  expect(calls).toEqual([
    { collection: "sessions", filters: { id: session.id }, limit: 1 },
  ]);
  const sample = {
    ...session,
    officeId: undefined,
    contentScope: undefined,
    termId: undefined,
  };
  expect(await loadSession(sample.id, reader({ sessions: [sample] }))).toEqual(
    sample,
  );
  expect(
    await loadSession(
      session.id,
      reader({ sessions: [{ ...session, contentScope: "executive" }] }),
    ),
  ).toBeUndefined();
  expect(
    await loadSession("missing", reader({ sessions: [session] })),
  ).toBeUndefined();
  const invalidCalls: typeof calls = [];
  for (const id of [
    "",
    "../61st-regular",
    "61st/regular",
    "id?query=all",
    "x".repeat(201),
  ])
    expect(await loadSession(id, reader({}, invalidCalls))).toBeUndefined();
  expect(invalidCalls).toEqual([]);
});

test("only passed measures explicitly linked to this session, date, office and term appear", async () => {
  const rejected: LegislativeDocument[] = [
    { ...ordinance, id: "other-session", sessionId: "same-day-special" },
    { ...ordinance, id: "date-only", sessionId: undefined },
    { ...ordinance, id: "other-date", dateApproved: "2026-09-21" },
    { ...ordinance, id: "pending", status: "Pending" },
    { ...ordinance, id: "draft", status: "Draft" },
    { ...ordinance, id: "proposed", status: "Proposed" },
    { ...ordinance, id: "other-term", termId: "past-term" },
    { ...ordinance, id: "unassigned-term", termId: undefined },
    { ...ordinance, id: "other-office", officeId: "other-office" },
    { ...ordinance, id: "unknown-office", officeId: undefined },
    { ...ordinance, id: "executive", contentScope: "executive" },
    { ...ordinance, id: "unknown-scope", contentScope: undefined },
  ];
  const calls: {
    collection: Collection;
    filters?: ContentFilters;
    limit?: number;
  }[] = [];
  const resolution = {
    ...ordinance,
    id: "community-resolution",
    approvalMode: "mass_motion" as const,
    author: "",
    status: " Adopted ",
  };
  const minutes = {
    ...agenda,
    id: "session-minutes",
    documentType: "minutes" as const,
    date: "2026-10-01",
  };
  const documents: MunicipalDocument[] = [
    agenda,
    minutes,
    { ...agenda, id: "other-agenda", sessionId: "same-day-special" },
    { ...agenda, id: "other-office-agenda", officeId: "other-office" },
    { ...agenda, id: "other-term-agenda", termId: "past-term" },
    { ...agenda, id: "executive-order", documentType: "executive-order" },
    { ...agenda, id: "transparency", contentScope: "transparency" },
  ];
  expect(
    await loadSessionRecords(
      session,
      reader(
        {
          ordinances: [ordinance, ...rejected],
          resolutions: [resolution, ...rejected],
          documents,
        },
        calls,
      ),
    ),
  ).toEqual({
    ordinances: [ordinance],
    resolutions: [resolution],
    agendas: [agenda],
    minutes: [minutes],
  });
  expect(calls).toEqual([
    {
      collection: "ordinances",
      filters: {
        session_id: session.id,
        content_scope: "legislative",
        term_id: session.termId,
        office_id: session.officeId,
        date_approved: session.date,
      },
      limit: undefined,
    },
    {
      collection: "resolutions",
      filters: {
        session_id: session.id,
        content_scope: "legislative",
        term_id: session.termId,
        office_id: session.officeId,
        date_approved: session.date,
      },
      limit: undefined,
    },
    {
      collection: "documents",
      filters: {
        session_id: session.id,
        content_scope: "legislative",
        term_id: session.termId,
        office_id: session.officeId,
        document_type: "agenda",
      },
      limit: undefined,
    },
    {
      collection: "documents",
      filters: {
        session_id: session.id,
        content_scope: "legislative",
        term_id: session.termId,
        office_id: session.officeId,
        document_type: "minutes",
      },
      limit: undefined,
    },
  ]);
});

test("unassigned historical sessions stay unassigned and empty or foreign sessions stay empty", async () => {
  const calls: {
    collection: Collection;
    filters?: ContentFilters;
    limit?: number;
  }[] = [];
  const historical = { ...session, termId: undefined };
  const unassigned = { ...ordinance, termId: undefined };
  const result = await loadSessionRecords(
    historical,
    reader({ ordinances: [ordinance, unassigned] }, calls),
  );
  expect(result.ordinances).toEqual([unassigned]);
  expect(calls.every((call) => call.filters?.term_id === null)).toBe(true);
  expect(await loadSessionRecords(session, reader({}))).toEqual({
    ordinances: [],
    resolutions: [],
    agendas: [],
    minutes: [],
  });
  const foreignCalls: typeof calls = [];
  expect(
    await loadSessionRecords(
      { ...session, contentScope: "executive" },
      reader({ ordinances: [ordinance] }, foreignCalls),
    ),
  ).toEqual({ ordinances: [], resolutions: [], agendas: [], minutes: [] });
  expect(foreignCalls).toEqual([]);
});

const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
};
const numberedRow = {
  id: ordinance.id,
  number: ordinance.number,
  title: ordinance.title,
  date_approved: session.date,
  year: 2026,
  author: ordinance.author,
  co_author: null,
  summary: ordinance.summary,
  status: "Approved",
  pdf_url: null,
  approval_mode: "authored",
  office_id: session.officeId,
  term_id: session.termId,
  content_scope: "legislative",
  session_id: session.id,
  is_sample: false,
  published: true,
};
const documentRow = {
  id: agenda.id,
  title: agenda.title,
  description: agenda.description,
  date: agenda.date,
  document_type: "agenda",
  file_url: agenda.fileUrl,
  office_id: session.officeId,
  term_id: session.termId,
  content_scope: "legislative",
  session_id: session.id,
  is_sample: false,
  published: true,
  deleted_at: null,
};

test("Supabase queries retain publication, soft-delete and session filters on every capped page", async () => {
  const calls: URL[] = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    ordinances: [
      numberedRow,
      { ...numberedRow, id: "second-ordinance" },
      { ...numberedRow, id: "draft-ordinance", published: false },
      { ...numberedRow, id: "other-session", session_id: "same-day-special" },
      { ...numberedRow, id: "other-date", date_approved: "2026-09-21" },
      { ...numberedRow, id: "pending", status: "Pending" },
      { ...numberedRow, id: "other-term", term_id: "past-term" },
      { ...numberedRow, id: "other-office", office_id: "other-office" },
      { ...numberedRow, id: "other-scope", content_scope: "executive" },
    ],
    resolutions: [
      { ...numberedRow, id: "community-resolution", status: "aDoPtEd" },
    ],
    municipal_documents: [
      documentRow,
      { ...documentRow, id: "second-agenda" },
      {
        ...documentRow,
        id: "session-minutes",
        date: "2026-10-01",
        document_type: "minutes",
      },
      {
        ...documentRow,
        id: "deleted-agenda",
        deleted_at: "2026-10-01T00:00:00Z",
      },
      { ...documentRow, id: "draft-agenda", published: false },
      { ...documentRow, id: "other-agenda", session_id: "same-day-special" },
      {
        ...documentRow,
        id: "executive-order",
        document_type: "executive-order",
      },
    ],
  };
  const read = <K extends Collection>(
    collection: K,
    filters?: ContentFilters,
    limit?: number,
  ) =>
    readSupabaseCollection(
      collection,
      config,
      async (url, init) => {
        const parsed = new URL(url);
        calls.push(parsed);
        const params = parsed.searchParams;
        expect(params.get("published")).toBe("eq.true");
        expect(params.get("session_id")).toBe(`eq.${session.id}`);
        expect(params.get("content_scope")).toBe("eq.legislative");
        expect(params.get("office_id")).toBe(`eq.${session.officeId}`);
        expect(params.get("term_id")).toBe(`eq.${session.termId}`);
        expect(init.cache).toBe("no-store");
        const table = parsed.pathname.split("/").at(-1)!;
        if (table === "municipal_documents") {
          expect(params.get("deleted_at")).toBe("is.null");
          expect(params.has("date")).toBe(false);
        } else {
          expect(params.get("date_approved")).toBe(`eq.${session.date}`);
          expect(params.has("status")).toBe(false);
        }
        const matching = tables[table].filter((row) =>
          [...params].every(([key, value]) => {
            if (["select", "order", "limit", "offset"].includes(key))
              return true;
            return value === "is.null"
              ? row[key] == null
              : String(row[key]) === value.slice(3);
          }),
        );
        const offset = Number(params.get("offset"));
        return Response.json(matching.slice(offset, offset + 1), {
          headers: {
            "content-range": `${offset}-${offset}/${matching.length}`,
          },
        });
      },
      filters,
      limit,
    );
  const result = await loadSessionRecords(session, read);
  expect(result.ordinances.map((document) => document.id)).toEqual([
    ordinance.id,
    "second-ordinance",
  ]);
  expect(result.resolutions.map((document) => document.id)).toEqual([
    "community-resolution",
  ]);
  expect(result.agendas.map((document) => document.id)).toEqual([
    agenda.id,
    "second-agenda",
  ]);
  expect(result.minutes.map((document) => document.id)).toEqual([
    "session-minutes",
  ]);
  expect(calls).toHaveLength(7);
  expect(
    calls.filter((url) => url.searchParams.get("offset") === "1"),
  ).toHaveLength(2);
});

test("an unassigned session uses SQL is.null rather than omitting its term filter", async () => {
  await loadSessionRecords(
    { ...session, termId: undefined },
    <K extends Collection>(collection: K, filters?: ContentFilters) =>
      readSupabaseCollection(
        collection,
        config,
        async (url) => {
          expect(new URL(url).searchParams.get("term_id")).toBe("is.null");
          return Response.json([]);
        },
        filters,
      ),
  );
});

test("session and related-document failures propagate instead of showing sample records", async () => {
  await expect(
    loadSession(session.id, async () => {
      throw new Error("Session unavailable");
    }),
  ).rejects.toThrow("Session unavailable");
  for (const collection of [
    "ordinances",
    "resolutions",
    "documents",
  ] as const) {
    await expect(
      loadSessionRecords(
        session,
        <K extends Collection>(requested: K, filters?: ContentFilters) =>
          readSupabaseCollection(
            requested,
            config,
            async () =>
              requested === collection
                ? new Response("Unavailable", { status: 503 })
                : Response.json([]),
            filters,
          ),
      ),
    ).rejects.toThrow("HTTP 503");
  }
});
