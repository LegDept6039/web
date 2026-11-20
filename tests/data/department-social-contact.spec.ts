import { expect, test } from "@playwright/test";
import { parseContent } from "../../lib/admin/content";
import { decodeRecord } from "../../lib/content/schema";

const row = {
  id: "social-contact",
  office_id: "10000000-0000-4000-8000-000000000005",
  content_scope: "executive",
  type: "SOCIAL",
  label: "Official Facebook Page",
  value: "https://www.facebook.com/municipal-health?ref=contact",
  is_sample: false,
};

test("social contact saves reuse label and value, trim inputs and retain ownership", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(row))
    if (typeof value === "string") form.set(key, value);
  form.set("label", `  ${row.label}  `);
  form.set("value", `  ${row.value}  `);
  form.set("published", "on");
  form.set("sort_order", "1");
  expect(parseContent("contacts", form)).toMatchObject({
    type: "SOCIAL",
    label: row.label,
    value: row.value,
    office_id: row.office_id,
    content_scope: "executive",
    published: true,
  });
  expect(decodeRecord("contacts", row)).toMatchObject({
    type: "SOCIAL",
    label: row.label,
    value: row.value,
    officeId: row.office_id,
  });
});

test("social contacts reject missing labels and unsafe or oversized URLs", () => {
  for (const label of [null, "", " \t\n ", "x".repeat(101)])
    expect(() => decodeRecord("contacts", { ...row, label })).toThrow(/label/);
  for (const value of [
    "javascript:alert(1)",
    "http://www.facebook.com/office",
    "/social",
    "//facebook.com/office",
    "https://user:password@facebook.com/office",
    "https://facebook.com\\@evil.test/office",
    "https://facebook.com/white space",
    "https://facebook.com/<script>",
    'https://facebook.com/"quote',
    "https://facebook.com/'quote",
    "https://facebook.com:99999/page",
    `https://facebook.com/${"a".repeat(1000)}`,
  ])
    expect(() => decodeRecord("contacts", { ...row, value }), value).toThrow(
      /HTTPS social link/,
    );
});

