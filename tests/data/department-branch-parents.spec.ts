import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBarangayAffairsOffice } from "../../lib/barangays/permissions";

interface ParentRow {
  id: string;
  name: string;
  active: boolean;
  slug: string;
  department: "executive" | "legislative";
  parent_department_id: string | null;
  archived_at: string | null;
}
interface ParentOption {
  id: string;
  name: string;
  active: boolean;
}
type Options = (
  client: SupabaseClient,
  currentId?: string,
  existingParentId?: string | null,
) => Promise<ParentOption[]>;

function loadOptions() {
  const exports: { departmentParentOptions?: Options } = {};
  runInNewContext(
    ts.transpileModule(readFileSync("lib/offices/branch-parents.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require(name: string) {
        if (name === "server-only") return {};
        if (name === "@/lib/barangays/permissions")
          return { isBarangayAffairsOffice };
        throw new Error(`Unexpected parent-options import: ${name}`);
      },
    },
  );
  return exports.departmentParentOptions!;
}
const options = loadOptions();
function row(id: string, name: string, override: Partial<ParentRow> = {}): ParentRow {
  return {
    id, name, active: true, slug: name.toLowerCase().replaceAll(" ", "-"),
    department: "executive", parent_department_id: null, archived_at: null,
    ...override,
  };
}
function fixture(
  rows: ParentRow[],
  { cap = 2, exactCount = true, failPage = -1 } = {},
) {
  const calls: {
    table: string;
    select: string;
    count: unknown;
    filters: [string, unknown][];
    order: string[];
    range: [number, number];
  }[] = [];
  const client = {
    from(table: string) {
      let columns = "";
      let count: unknown;
      const filters: [string, unknown][] = [];
      const order: string[] = [];
      const query = {
        select(value: string, settings?: { count?: string }) {
          columns = value;
          count = settings?.count;
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        is(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        order(key: string) {
          order.push(key);
          return query;
        },
        async range(from: number, to: number) {
          calls.push({ table, select: columns, count, filters, order, range: [from, to] });
          if (calls.length === failPage)
            return { data: null, error: { code: "PGRST204" }, count: null };
          const filtered = rows.filter((record) =>
            filters.every(([key, value]) => record[key as keyof ParentRow] === value),
          ).sort((left, right) => {
            for (const key of order) {
              const a = String(left[key as keyof ParentRow]);
              const b = String(right[key as keyof ParentRow]);
              if (a !== b) return a < b ? -1 : 1;
            }
            return 0;
          });
          return {
            data: filtered.slice(from, Math.min(to + 1, from + cap)),
            error: null,
            count: exactCount ? filtered.length : null,
          };
        },
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("parent options follow actual capped rows while excluding self, branches, Legislative and access workspaces", async () => {
  const { client, calls } = fixture([
    row("self", "Alpha"),
    row("affairs", "Barangay Affairs", { slug: "barangay-affairs" }),
    row("inactive", "Beta", { active: false }),
    row("archived", "Cedar", { archived_at: "2026-11-01T00:00:00Z" }),
    row("draft", "Draft department"),
    row("active", "Echo"),
    row("existing", "Foxtrot", { archived_at: "2026-11-01T00:00:00Z" }),
    row("last", "Golf"),
    row("nested", "Nested", { parent_department_id: "self" }),
    row("legislative", "Legislative Access", { department: "legislative" }),
  ]);
  expect(await options(client, "self", "existing")).toEqual([
    { id: "inactive", name: "Beta", active: false },
    { id: "draft", name: "Draft department", active: true },
    { id: "active", name: "Echo", active: true },
    { id: "existing", name: "Foxtrot", active: false },
    { id: "last", name: "Golf", active: true },
  ]);
  expect(calls.map((call) => call.range)).toEqual([
    [0, 199], [2, 201], [4, 203], [6, 205],
  ]);
  for (const call of calls) {
    expect(call.table).toBe("departments");
    expect(call.count).toBe("exact");
    expect(call.filters).toEqual([
      ["department", "executive"], ["parent_department_id", null],
    ]);
    expect(call.order).toEqual(["name", "id"]);
    expect(call.select).toContain("archived_at");
  }
});

test("missing exact counts keep fetching through a short capped final page", async () => {
  const { client, calls } = fixture([
    row("one", "One"), row("two", "Two"), row("three", "Three"),
  ], { exactCount: false });
  expect((await options(client)).map((parent) => parent.id)).toEqual(["one", "three", "two"]);
  expect(calls.map((call) => call.range[0])).toEqual([0, 2, 3]);
});

test("a later query failure rejects the entire parent selector rather than returning partial choices", async () => {
  const { client, calls } = fixture([
    row("one", "One"), row("two", "Two"), row("three", "Three"),
  ], { cap: 1, failPage: 2 });
  const failure = await options(client).then(
    () => "Unexpected successful result",
    (error: Error) => error.message,
  );
  expect(failure).toMatch(/Unable to load parent departments.*migration 034/);
  expect(calls.map((call) => call.range[0])).toEqual([0, 1]);
});

test("new selectors omit archived parents, while editing retains only its current archived relationship", async () => {
  const rows = [
    row("one", "Archived one", { archived_at: "2026-11-01T00:00:00Z" }),
    row("two", "Archived two", { archived_at: "2026-11-02T00:00:00Z" }),
  ];
  expect(await options(fixture(rows).client)).toEqual([]);
  expect(await options(fixture(rows).client, "unrelated", "two")).toEqual([
    { id: "two", name: "Archived two", active: false },
  ]);
});
