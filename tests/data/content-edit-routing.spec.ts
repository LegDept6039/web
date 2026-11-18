import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the route with isolated storage/auth dependencies; no live staff data.
async function openRecord(authorized: boolean, office: string, exists = true) {
  const row = {
    id: "finance",
    name: "Renamed Tourism Committee",
    office_id: "actual-office",
    content_scope: "legislative",
  };
  const query = {
    select: () => query,
    eq: (key: string, value: string) => {
      expect(key).toBe("id");
      expect(value).toBe("finance");
      return query;
    },
    maybeSingle: async () => ({ data: exists ? row : null, error: null }),
  };
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "@/lib/legislative/server": {},
    "@/lib/legislative/config": {},
    "@/lib/auth/diagnostics": { authDiagnostic: () => undefined },
    "@/components/admin/ContentBreadcrumb": {},
    "next/navigation": {
      notFound: () => {
        throw new Error("NOT_FOUND");
      },
      redirect: (url: string) => {
        throw new Error(`REDIRECT:${url}`);
      },
    },
    "@/lib/offices/server": {
      officeContext: async () => ({
        client: { from: () => query },
        profile: { role: "editor" },
        access: [],
      }),
      contentAllowed: () => authorized,
    },
    "@/lib/admin/content": { collectionName: () => "committees" },
    "@/lib/content/schema": {
      definitions: { committees: { table: "committees", key: "id" } },
    },
    "../../../ContentForm": {},
  };
  const output = ts.transpileModule(
    readFileSync("app/admin/content/[collection]/edit/[id]/page.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: { default?: (args: unknown) => Promise<unknown> } = {};
  runInNewContext(output, {
    exports,
    require: (name: string) => {
      if (!(name in dependencies))
        throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports.default!({
    params: Promise.resolve({ collection: "committees", id: "finance" }),
    searchParams: Promise.resolve({ office }),
  });
}

test("authorized stale office bookmarks redirect using the unchanged record ID", async () => {
  await expect(openRecord(true, "stale-office")).rejects.toThrow(
    "REDIRECT:/admin/content/committees/edit/finance?office=actual-office",
  );
});

test("stale office bookmarks do not bypass record authorization or existence checks", async () => {
  await expect(openRecord(false, "stale-office")).rejects.toThrow("NOT_FOUND");
  await expect(openRecord(true, "stale-office", false)).rejects.toThrow(
    "NOT_FOUND",
  );
});
