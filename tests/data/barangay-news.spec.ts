import { test, expect } from "@playwright/test";
import {
  readBarangayNews,
  validateNewsBarangay,
} from "../../lib/barangays/news";
import { decodeRecord } from "../../lib/content/schema";
import { parseContent } from "../../lib/admin/content";
import { newsOfficeOptions } from "../../lib/news/source";

const barangay = "00000000-0000-4000-8000-000000000026";
const otherBarangay = "00000000-0000-4000-8000-000000000025";
const config = { url: "https://example.supabase.co", key: "public-test-key" };
const row = {
  id: "00000000-0000-4000-8000-000000000001",
  office_id: "00000000-0000-4000-8000-000000000002",
  barangay_id: barangay,
  content_scope: "executive",
  slug: "community-news",
  title: "Community news",
  category: "Barangay Affairs",
  date: "2026-11-23",
  excerpt: "The latest community news.",
  image: "/images/department-placeholder.svg",
  content: ["Community news body."],
  published: true,
  is_sample: false,
  source: { name: "Tutay" },
};

test("only Barangay Affairs news accepts a validated existing barangay", async () => {
  const found: string[] = [];
  const lookup = async (id: string) => {
    found.push(id);
    return { id }; // Publication does not restrict staff editing choices.
  };
  expect(await validateNewsBarangay(barangay, true, lookup)).toBe(barangay);
  expect(found).toEqual([barangay]);
  expect(await validateNewsBarangay(null, false, lookup)).toBeNull();
  for (const input of [null, "", "made-up", "bad/uuid"])
    await expect(validateNewsBarangay(input, true, lookup)).rejects.toThrow(
      "Choose a barangay",
    );
  await expect(validateNewsBarangay(barangay, false, lookup)).rejects.toThrow(
    "must belong to Barangay Affairs",
  );
  await expect(
    validateNewsBarangay(barangay, true, async () => null),
  ).rejects.toThrow("Choose an existing barangay");
  expect(found).toEqual([barangay]);
});

test("news decoding and parsing retain the optional barangay identity", () => {
  expect(decodeRecord("news", row)).toMatchObject({
    barangayId: barangay,
    source: { name: "Tutay" },
  });
  expect(
    decodeRecord("news", { ...row, barangay_id: null }),
  ).not.toHaveProperty("barangayId");
  const form = new FormData();
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string") form.set(key, value);
  }
  form.set("content", row.content.join("\n"));
  expect(parseContent("news", form)).toMatchObject({ barangay_id: barangay });
  form.delete("barangay_id");
  expect(parseContent("news", form)).toMatchObject({ barangay_id: null });
});

test("barangay news queries the public projection and verifies publication and ownership", async () => {
  const requests: URL[] = [];
  const articles = await readBarangayNews(config, barangay, async (url) => {
    requests.push(new URL(url));
    return Response.json([row], { headers: { "content-range": "0-0/1" } });
  });
  expect(articles).toHaveLength(1);
  expect(articles[0].barangayId).toBe(barangay);
  expect(articles[0].source).toEqual({ name: "Tutay" });
  expect(requests).toHaveLength(1);
  expect(requests[0].pathname).toBe("/rest/v1/published_news");
  expect(requests[0].searchParams.get("barangay_id")).toBe(`eq.${barangay}`);
  expect(requests[0].searchParams.get("published")).toBe("eq.true");
  expect(requests[0].searchParams.get("content_scope")).toBe("eq.executive");
  expect(requests[0].searchParams.get("select")?.split(",")).toContain(
    "published",
  );
  for (const invalid of [
    { ...row, barangay_id: otherBarangay },
    { ...row, barangay_id: null },
    { ...row, published: false },
    { ...row, content_scope: "legislative" },
  ])
    await expect(
      readBarangayNews(config, barangay, async () => Response.json([invalid])),
    ).rejects.toThrow();
});

test("barangay news keeps pagination and source filter identities separate", async () => {
  const offsets: string[] = [];
  const articles = await readBarangayNews(config, barangay, async (url) => {
    const offset = new URL(url).searchParams.get("offset")!;
    offsets.push(offset);
    return Response.json([{ ...row, slug: `community-news-${offset}` }], {
      headers: { "content-range": `${offset}-${offset}/2` },
    });
  });
  expect(articles).toHaveLength(2);
  expect(offsets).toEqual(["0", "1"]);
  expect(
    newsOfficeOptions([
      decodeRecord("news", row),
      decodeRecord("news", {
        ...row,
        barangay_id: otherBarangay,
        source: { name: "Tupas" },
      }),
    ]),
  ).toEqual([
    { id: `barangay:${otherBarangay}`, name: "Tupas" },
    { id: `barangay:${barangay}`, name: "Tutay" },
  ]);
});
