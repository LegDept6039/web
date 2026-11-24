import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { decodeRecord } from "../../lib/content/schema";
import {
  readSupabaseCollection,
  type ContentFilters,
} from "../../lib/content/supabase";
import type { Department } from "../../types";

const treasuryId = "97000000-0000-4000-8000-000000000001";
const engineeringId = "97000000-0000-4000-8000-000000000002";
const marketId = "97000000-0000-4000-8000-000000000003";
const slaughterId = "97000000-0000-4000-8000-000000000004";
const waterworksId = "97000000-0000-4000-8000-000000000005";
const treasury: Department = {
  id: treasuryId,
  slug: "treasury",
  name: "Municipal Treasurer's Office",
  description: "Treasury services",
  active: true,
  contentScope: "executive",
};
const engineering: Department = {
  ...treasury,
  id: engineeringId,
  slug: "engineering",
  name: "Municipal Engineering Office",
};
const market: Department = {
  ...treasury,
  id: marketId,
  slug: "market-affairs",
  name: "Market Affairs",
  parentDepartmentId: treasuryId,
  imageUrl: "/images/departments/market.webp",
};
const slaughter: Department = {
  ...market,
  id: slaughterId,
  slug: "slaughter-house",
  name: "Slaughter House",
};
const waterworks: Department = {
  ...market,
  id: waterworksId,
  slug: "waterworks",
  name: "Waterworks",
  parentDepartmentId: engineeringId,
};

interface DepartmentApi {
  getDepartments(): Promise<Department[]>;
  getDepartment(slug: string): Promise<Department | undefined>;
  getDepartmentParent(d: Department): Promise<Department | undefined>;
  getDepartmentBranches(id: string): Promise<Department[]>;
}
function departmentApi(
  rows: Department[],
  aliases: Record<string, string> = {},
) {
  const calls: Record<string, string>[] = [];
  const exports: Partial<DepartmentApi> = {};
  const dependencies: Record<string, unknown> = {
    "@/lib/content/config": {
      readContentConfig: () => ({
        source: "supabase",
        supabase: {
          url: "https://example.supabase.co",
          key: "sb_publishable_test",
        },
      }),
    },
    "@/lib/content/repository": {
      getCollection: async (
        collection: string,
        filters: Record<string, string> = {},
      ) => {
        expect(collection).toBe("departments");
        calls.push(filters);
        return rows.filter((d) =>
          Object.entries(filters).every(([key, value]) =>
            key === "parent_department_id"
              ? d.parentDepartmentId === value
              : d[key as keyof Department] === value,
          ),
        );
      },
    },
  };
  runInNewContext(
    ts.transpileModule(readFileSync("lib/api/index.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      process: { env: {} },
      URLSearchParams,
      AbortSignal,
      fetch: async (url: string) => {
        const params = new URL(url).searchParams;
        const id = aliases[params.get("slug")?.slice(3) || ""];
        return Response.json(id ? [{ department_id: id }] : []);
      },
      require(name: string) {
        if (!(name in dependencies))
          throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
      },
    },
  );
  return { api: exports as DepartmentApi, calls };
}

test("department rows decode the optional parent without changing legacy records", () => {
  const row = {
    id: marketId,
    name: market.name,
    slug: market.slug,
    description: market.description,
    image_url: market.imageUrl,
    is_sample: false,
  };
  expect(decodeRecord("departments", row)).not.toHaveProperty(
    "parentDepartmentId",
  );
  expect(
    decodeRecord("departments", { ...row, parent_department_id: null }),
  ).not.toHaveProperty("parentDepartmentId");
  expect(
    decodeRecord("departments", {
      ...row,
      parent_department_id: treasuryId,
    }),
  ).toMatchObject({ id: marketId, parentDepartmentId: treasuryId });
});

test("public branch queries retain publication and lifecycle filters across server row caps", async () => {
  const calls: URL[] = [];
  const result = await readSupabaseCollection(
    "departments",
    { url: "https://example.supabase.co", key: "sb_publishable_test" },
    async (url) => {
      const request = new URL(url);
      calls.push(request);
      const params = request.searchParams;
      expect(params.get("published")).toBe("eq.true");
      expect(params.get("active")).toBe("eq.true");
      expect(params.get("archived_at")).toBe("is.null");
      expect(params.get("department")).toBe("eq.executive");
      expect(params.get("parent_department_id")).toBe(`eq.${treasuryId}`);
      expect(params.get("select")?.split(",")).toContain(
        "parent_department_id",
      );
      expect(params.get("order")).toBe("sort_order.asc,id.asc");
      return Response.json(
        [
          {
            id: calls.length === 1 ? marketId : slaughterId,
            name: calls.length === 1 ? market.name : slaughter.name,
            description: "",
            parent_department_id: treasuryId,
            is_sample: false,
          },
        ],
        {
          headers: {
            "content-range": `${calls.length - 1}-${calls.length - 1}/2`,
          },
        },
      );
    },
    { parent_department_id: treasuryId },
  );
  expect(result.map((d) => d.id)).toEqual([marketId, slaughterId]);
  expect(calls.map((url) => url.searchParams.get("offset"))).toEqual([
    "0",
    "1",
  ]);
});

test("directory keeps department and branch order and excludes inactive or unavailable parents", async () => {
  const rows = [waterworks, treasury, market, engineering, slaughter];
  expect(
    (await departmentApi(rows).api.getDepartments()).map((d) => d.id),
  ).toEqual(rows.map((d) => d.id));
  for (const hiddenParent of [
    undefined,
    { ...treasury, active: false },
    { ...treasury, contentScope: "legislative" as const },
    { ...treasury, parentDepartmentId: engineeringId },
  ]) {
    const { api } = departmentApi([
      engineering,
      market,
      slaughter,
      waterworks,
      ...(hiddenParent ? [hiddenParent] : []),
    ]);
    const result = await api.getDepartments();
    expect(result.map((d) => d.id)).not.toContain(marketId);
    expect(result.map((d) => d.id)).not.toContain(slaughterId);
    expect(result.map((d) => d.id)).toContain(waterworksId);
  }
});

test("detail branch lookups require both the branch and top-level parent to be public", async () => {
  const { api, calls } = departmentApi([
    treasury,
    market,
    slaughter,
    waterworks,
  ]);
  expect(await api.getDepartment("market-affairs")).toEqual(market);
  expect(await api.getDepartmentParent(market)).toEqual(treasury);
  expect(await api.getDepartmentBranches(treasuryId)).toEqual([
    market,
    slaughter,
  ]);
  expect(calls).toContainEqual({ parent_department_id: treasuryId });
  expect(await api.getDepartmentBranches(marketId)).toEqual([]);
  expect(await api.getDepartment("waterworks")).toBeUndefined();
  expect(await api.getDepartmentParent(waterworks)).toBeUndefined();
  expect(await api.getDepartmentBranches(engineeringId)).toEqual([]);
  expect(
    await departmentApi([
      { ...treasury, active: false },
      market,
    ]).api.getDepartment("market-affairs"),
  ).toBeUndefined();
  expect(
    await departmentApi([
      treasury,
      { ...market, active: false },
    ]).api.getDepartment("market-affairs"),
  ).toBeUndefined();
});

test("branch aliases retain canonical identities and cannot reveal a hidden parent", async () => {
  const aliases = { "former-market": marketId };
  const { api } = departmentApi([treasury, market], aliases);
  expect(await api.getDepartment("former-market")).toMatchObject({
    id: marketId,
    slug: "market-affairs",
    parentDepartmentId: treasuryId,
  });
  expect(
    await departmentApi([market], aliases).api.getDepartment("former-market"),
  ).toBeUndefined();
  expect(await api.getDepartment("../treasury")).toBeUndefined();
});

test("top-level department previews apply null-parent filtering before the query limit", async () => {
  await readSupabaseCollection(
    "departments",
    { url: "https://example.supabase.co", key: "sb_publishable_test" },
    async (url) => {
      const params = new URL(url).searchParams;
      expect(params.get("parent_department_id")).toBe("is.null");
      expect(params.get("limit")).toBe("4");
      expect(params.get("published")).toBe("eq.true");
      expect(params.get("active")).toBe("eq.true");
      expect(params.get("order")).toBe("sort_order.asc,id.asc");
      return Response.json([]);
    },
    { parent_department_id: null },
    4,
  );
});

test("mock null-parent filters include legacy missing parents and run before slicing", async () => {
  const rows = [
    market,
    slaughter,
    { ...treasury, parentDepartmentId: null },
    engineering,
    waterworks,
  ];
  const exports: {
    getCollection?: (
      collection: string,
      filters: ContentFilters,
      limit?: number,
    ) => Promise<Department[]>;
  } = {};
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    react: { cache: (fn: unknown) => fn },
    "next/server": {
      connection: () => {
        throw new Error("Unexpected database connection");
      },
    },
    "./config": { readContentConfig: () => ({ source: "mock" }) },
    "./mock": { readMockCollection: () => rows },
    "./supabase": {
      readSupabaseCollection: () => {
        throw new Error("Unexpected database read");
      },
    },
  };
  runInNewContext(
    ts.transpileModule(readFileSync("lib/content/repository.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      process: { env: {} },
      require(name: string) {
        if (!(name in dependencies))
          throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
      },
    },
  );
  expect(
    (
      await exports.getCollection!(
        "departments",
        { parent_department_id: null },
        2,
      )
    ).map((d) => d.id),
  ).toEqual([treasuryId, engineeringId]);
  expect(
    (
      await exports.getCollection!(
        "departments",
        { parent_department_id: treasuryId },
        1,
      )
    ).map((d) => d.id),
  ).toEqual([marketId]);
});
