import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLegislativeDashboard } from "../../lib/legislative/dashboard";

const office = "10000000-0000-4000-8000-000000000001";
const term = "20000000-0000-4000-8000-000000000001";
type Row = Record<string, unknown>;
type Request = {
  table: string;
  columns: string;
  head: boolean;
  filters: [string, unknown][];
  nullFilters: string[];
  orders: string[];
  range?: [number, number];
};

function scoped(id: string, details: Row = {}): Row {
  return {
    id,
    office_id: office,
    content_scope: "legislative",
    term_id: term,
    published: true,
    deleted_at: null,
    ...details,
  };
}

function fixture(
  tables: Record<string, Row[]> = {},
  options: {
    cap?: number;
    fail?: (request: Request) => "error" | "throw" | "empty" | undefined;
  } = {},
) {
  const requests: Request[] = [];
  const client = {
    from(table: string) {
      const request: Request = {
        table,
        columns: "",
        head: false,
        filters: [],
        nullFilters: [],
        orders: [],
      };
      async function execute() {
        requests.push(structuredClone(request));
        const failure = options.fail?.(request);
        if (failure === "throw") throw new Error("Network unavailable");
        if (failure === "error")
          return { data: null, error: { code: "42501" }, count: null };
        let rows = [...(tables[table] ?? [])].filter(
          (row) =>
            request.filters.every(([key, value]) => row[key] === value) &&
            request.nullFilters.every((key) => row[key] == null),
        );
        for (const key of [...request.orders].reverse())
          rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
        const count = rows.length;
        const [from, to] = request.range ?? [0, rows.length - 1];
        rows = rows.slice(from, Math.min(to + 1, from + (options.cap ?? 500)));
        return {
          data: request.head ? null : failure === "empty" ? [] : rows,
          error: null,
          count,
        };
      }
      const query = {
        select(columns: string, settings: { head?: boolean }) {
          request.columns = columns;
          request.head = settings.head === true;
          return query;
        },
        eq(key: string, value: unknown) {
          request.filters.push([key, value]);
          return query;
        },
        is(key: string, value: null) {
          expect(value).toBeNull();
          request.nullFilters.push(key);
          return query;
        },
        order(key: string) {
          request.orders.push(key);
          return query;
        },
        range(from: number, to: number) {
          request.range = [from, to];
          return query;
        },
        overrideTypes() {
          return query;
        },
        then(
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) {
          return execute().then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, requests };
}

test("dashboard counts its office and term and attributes published measures by official ID", async () => {
  const officialRows = [
    scoped("a", {
      name: "Same name",
      sort_order: 2,
      legislative_role: "SANGGUNIANG_BAYAN",
    }),
    scoped("b", {
      name: "Same name",
      sort_order: 1,
      published: false,
      legislative_role: "SANGGUNIANG_BAYAN",
    }),
    scoped("zero", {
      name: "No measures",
      sort_order: 3,
      legislative_role: null,
    }),
    scoped("vice", {
      name: "Presiding official",
      sort_order: 0,
      legislative_role: "MUNICIPAL_VICE_MAYOR",
    }),
  ];
  const ordinanceRows = [
    scoped("o-1", { author_id: "b", co_author_id: "a" }),
    scoped("o-2", { author_id: "b", co_author_id: "vice" }),
    scoped("draft-o", { author_id: "a", co_author_id: "b", published: false }),
  ];
  const resolutionRows = [
    scoped("r-1", { author_id: "a", co_author_id: "b" }),
    scoped("r-2", { author_id: "a", co_author_id: "vice" }),
    scoped("r-3", { author_id: "b", co_author_id: "a" }),
  ];
  const tables = {
    officials: officialRows,
    ordinances: ordinanceRows,
    resolutions: resolutionRows,
    sessions: [scoped("s-1"), scoped("s-draft", { published: false })],
    municipal_documents: [
      scoped("d-1"),
      scoped("d-2"),
      scoped("d-deleted", { deleted_at: "2026-11-23T00:00:00Z" }),
      scoped("d-draft", { published: false }),
    ],
  };
  for (const [table, rows] of Object.entries(tables))
    rows.push(
      scoped(`${table}-foreign-office`, { office_id: "another-office" }),
      scoped(`${table}-foreign-branch`, { content_scope: "executive" }),
      scoped(`${table}-previous-term`, { term_id: "previous-term" }),
      scoped(`${table}-unassigned`, { term_id: null }),
    );
  const { client, requests } = fixture(tables);
  const result = await loadLegislativeDashboard(client, office, term);
  expect(result.counts).toEqual({
    officials: 4,
    ordinances: 2,
    resolutions: 3,
    sessions: 2,
    documents: 2,
  });
  expect(result.officials.map((row) => row.id)).toEqual(["b", "a", "zero"]);
  expect(result.officials.some((row) => row.id === "vice")).toBe(false);
  expect(result.officials[0]).toMatchObject({
    name: "Same name",
    ordinances: { authored: 2, coauthored: 0 },
    resolutions: { authored: 1, coauthored: 1 },
  });
  expect(result.officials[1]).toMatchObject({
    name: "Same name",
    ordinances: { authored: 0, coauthored: 1 },
    resolutions: { authored: 2, coauthored: 1 },
  });
  expect(result.officials[2]).toMatchObject({
    ordinances: { authored: 0, coauthored: 0 },
    resolutions: { authored: 0, coauthored: 0 },
  });
  expect(result.officialsAvailable).toBe(true);
  expect(result.authorshipAvailable).toEqual({
    ordinances: true,
    resolutions: true,
  });
  for (const request of requests) {
    expect(request.filters).toContainEqual(["office_id", office]);
    expect(request.filters).toContainEqual(["content_scope", "legislative"]);
    expect(request.filters).toContainEqual(["term_id", term]);
    if (["officials", "sessions"].includes(request.table))
      expect(request.filters.some(([key]) => key === "published")).toBe(false);
    else expect(request.filters).toContainEqual(["published", true]);
  }
  expect(
    requests.find((request) => request.table === "municipal_documents")
      ?.nullFilters,
  ).toContain("deleted_at");
  expect(
    requests
      .find((request) => request.table === "officials")
      ?.columns.split(","),
  ).toContain("legislative_role");
});

test("unassigned and absent terms stay isolated and empty results remain valid zeros", async () => {
  for (const selected of ["unassigned", "none"]) {
    const { client, requests } = fixture({
      officials: [
        scoped("assigned", { name: "Assigned" }),
        scoped("legacy", { name: "Legacy", term_id: null }),
      ],
      ordinances: [
        scoped("unassigned-o", { author_id: "legacy", term_id: null }),
      ],
    });
    const result = await loadLegislativeDashboard(client, office, selected);
    expect(result.counts).toEqual({
      officials: selected === "unassigned" ? 1 : 0,
      ordinances: selected === "unassigned" ? 1 : 0,
      resolutions: 0,
      sessions: 0,
      documents: 0,
    });
    expect(result.officialsAvailable).toBe(true);
    expect(result.authorshipAvailable).toEqual({
      ordinances: true,
      resolutions: true,
    });
    for (const request of requests) {
      if (selected === "unassigned")
        expect(request.nullFilters).toContain("term_id");
      else
        expect(request.filters).toContainEqual([
          "term_id",
          "00000000-0000-0000-0000-000000000000",
        ]);
    }
  }
});

test("authorship includes every page beyond 1000 rows and lower database row caps", async () => {
  const { client, requests } = fixture(
    {
      officials: [scoped("a", { name: "Council member" })],
      resolutions: Array.from({ length: 1207 }, (_, index) =>
        scoped(`r-${String(index).padStart(4, "0")}`, {
          author_id: "a",
          co_author_id: null,
        }),
      ),
    },
    { cap: 137 },
  );
  const result = await loadLegislativeDashboard(client, office, term);
  expect(result.counts.resolutions).toBe(1207);
  expect(result.officials[0].resolutions).toEqual({
    authored: 1207,
    coauthored: 0,
  });
  const pages = requests.filter((request) => request.table === "resolutions");
  expect(pages.map((request) => request.range?.[0])).toEqual([
    0, 137, 274, 411, 548, 685, 822, 959, 1096,
  ]);
  for (const request of pages) expect(request.orders).toEqual(["id"]);
});

test("missing or legacy text authors cannot be credited to a same-named official", async () => {
  const { client } = fixture({
    officials: [scoped("a", { name: "Shared name" })],
    resolutions: [
      scoped("legacy", {
        author: "Shared name",
        co_author: "Shared name",
        author_id: null,
        co_author_id: null,
      }),
      scoped("other-id", {
        author_id: "another-official",
        co_author_id: "another-official",
      }),
    ],
  });
  const result = await loadLegislativeDashboard(client, office, term);
  expect(result.counts.resolutions).toBe(2);
  expect(result.officials[0].resolutions).toEqual({
    authored: 0,
    coauthored: 0,
  });
});

test("failed requests show unavailable data while preserving successful cards and the other measure type", async () => {
  const { client } = fixture(
    {
      officials: [scoped("a", { name: "Council member" })],
      ordinances: [scoped("o", { author_id: "a" })],
    },
    {
      fail: ({ table }) =>
        table === "resolutions"
          ? "error"
          : table === "sessions"
            ? "throw"
            : undefined,
    },
  );
  const result = await loadLegislativeDashboard(client, office, term);
  expect(result.counts).toEqual({
    officials: 1,
    ordinances: 1,
    resolutions: null,
    sessions: null,
    documents: 0,
  });
  expect(result.officialsAvailable).toBe(true);
  expect(result.authorshipAvailable).toEqual({
    ordinances: true,
    resolutions: false,
  });
  expect(result.officials[0].ordinances.authored).toBe(1);
});

test("later page errors and premature empty pages never expose partial authorship totals", async () => {
  for (const failure of ["error", "throw", "empty"] as const) {
    const { client } = fixture(
      {
        officials: [scoped("a", { name: "Council member" })],
        resolutions: Array.from({ length: 501 }, (_, index) =>
          scoped(`r-${index}`, { author_id: "a" }),
        ),
      },
      {
        fail: ({ table, range }) =>
          table === "resolutions" && range?.[0] === 500 ? failure : undefined,
      },
    );
    const result = await loadLegislativeDashboard(client, office, term);
    expect(result.counts.resolutions).toBe(501);
    expect(result.authorshipAvailable.resolutions).toBe(false);
    expect(result.officials[0].resolutions.authored).toBe(0);
  }
});

test("failed official loading prevents a misleading empty officials table", async () => {
  const { client } = fixture(
    {},
    { fail: ({ table }) => (table === "officials" ? "error" : undefined) },
  );
  const result = await loadLegislativeDashboard(client, office, term);
  expect(result.counts.officials).toBeNull();
  expect(result.officials).toEqual([]);
  expect(result.officialsAvailable).toBe(false);
  expect(result.authorshipAvailable).toEqual({
    ordinances: false,
    resolutions: false,
  });
  expect(result.counts.documents).toBe(0);
});
