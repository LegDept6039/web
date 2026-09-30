import { test, expect } from "@playwright/test";
import { readContentConfig } from "../../lib/content/config";
import {
  readSupabaseCollection,
  type ContentFetch,
} from "../../lib/content/supabase";
import {
  decodeRecord,
  definitions,
  isSafeContentUrl,
  type Collection,
} from "../../lib/content/schema";
import { mockCollections } from "../../lib/content/mock";
const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
};
const row = {
  id: "office",
  name: "Administration",
  description: "Office information",
  is_sample: false,
};

test("mock mode is explicit; Supabase mode fails closed for missing or privileged credentials", () => {
  expect(readContentConfig({})).toEqual({ source: "mock" });
  expect(
    readContentConfig({
      CONTENT_SOURCE: "supabase",
      SUPABASE_URL: config.url,
      SUPABASE_PUBLISHABLE_KEY: config.key,
    }),
  ).toEqual({ source: "supabase", supabase: config });
  for (const env of [
    { CONTENT_SOURCE: "typo" },
    { CONTENT_SOURCE: "supabase" },
    {
      CONTENT_SOURCE: "supabase",
      SUPABASE_URL: config.url,
      SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-use",
    },
    {
      CONTENT_SOURCE: "supabase",
      SUPABASE_URL: "http://example.com",
      SUPABASE_PUBLISHABLE_KEY: config.key,
    },
  ])
    expect(() => readContentConfig(env)).toThrow();
});

test("all mock collections map cleanly through the database contract", () => {
  for (const collection of Object.keys(definitions) as Collection[]) {
    for (const record of mockCollections[collection]) {
      const input: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(definitions[collection].fields))
        input[field.column] =
          key === "isSample"
            ? true
            : (record[key as keyof typeof record] ?? null);
      expect(decodeRecord(collection, input)).toEqual({
        ...record,
        isSample: true,
      });
    }
  }
});

test("query reads published rows only, never sends a privileged token, and follows server row caps", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const request: ContentFetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json(
      [{ ...row, id: calls.length === 1 ? "office" : "second-office" }],
      {
        headers: {
          "content-range": `${calls.length - 1}-${calls.length - 1}/2`,
        },
      },
    );
  };
  const result = await readSupabaseCollection("departments", config, request);
  expect(result).toHaveLength(2);
  expect(calls).toHaveLength(2);
  expect(new URL(calls[0].url).searchParams.get("published")).toBe("eq.true");
  expect(new URL(calls[1].url).searchParams.get("offset")).toBe("1");
  expect(new URL(calls[0].url).searchParams.get("order")).toBe(
    "sort_order.asc,id.asc",
  );
  expect(calls[0].init.cache).toBe("no-store");
  expect(calls[0].init.redirect).toBe("error");
  expect(calls[0].init.headers).toEqual({
    apikey: config.key,
    Accept: "application/json",
    Prefer: "count=exact",
  });
});

test("empty database stays empty instead of silently showing mock records", async () => {
  expect(
    await readSupabaseCollection("news", config, async () => Response.json([])),
  ).toEqual([]);
});

test("errors and malformed rows do not leak credentials or become mock content", async () => {
  await expect(
    readSupabaseCollection(
      "news",
      config,
      async () => new Response(config.key, { status: 401 }),
    ),
  ).rejects.toThrow("HTTP 401");
  await expect(
    readSupabaseCollection("news", config, async () => {
      throw new Error(config.key);
    }),
  ).rejects.toThrow("Could not reach");
  await expect(
    readSupabaseCollection("news", config, async () =>
      Response.json({ error: config.key }),
    ),
  ).rejects.toThrow("Invalid database response");
  await expect(
    readSupabaseCollection("news", config, async () => Response.json([row])),
  ).rejects.toThrow("Invalid news");
  await expect(
    readSupabaseCollection("news", config, async () =>
      Response.json([], { headers: { "content-range": "*/2" } }),
    ),
  ).rejects.toThrow("Incomplete database response");
});

test("optional database nulls become optional domain fields", () => {
  expect(
    decodeRecord("officials", {
      id: "mayor",
      name: "Mayor",
      role: "Mayor",
      branch: "executive",
      description: "Office",
      photo_url: null,
      is_sample: false,
    }),
  ).toEqual({
    id: "mayor",
    name: "Mayor",
    role: "Mayor",
    branch: "executive",
    description: "Office",
    isSample: false,
  });
});

test("unsafe links and impossible dates are rejected", () => {
  for (const url of [
    "javascript:alert(1)",
    "//evil.example/image.png",
    "/\\evil.example/image",
    "https://user:password@example.com/file",
    "data:text/html,test",
  ])
    expect(isSafeContentUrl(url)).toBe(false);
  for (const url of [
    "/documents/sample.pdf",
    "https://example.supabase.co/storage/v1/object/public/municipal-media/file.pdf",
  ])
    expect(isSafeContentUrl(url)).toBe(true);
  expect(() =>
    decodeRecord("hearings", {
      id: "sample",
      title: "Meeting",
      date: "2026-02-31",
      venue: "Hall",
      sectors: "Residents",
      related_ordinance: "01",
      status: "Upcoming",
      is_sample: false,
    }),
  ).toThrow("date");
});
