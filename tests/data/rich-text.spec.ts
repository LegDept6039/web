import { test, expect } from "@playwright/test";
import {
  validateRichText,
  legacyDocument,
  richTextPlain,
} from "../../lib/content/rich-text";
import { publicationPosition } from "../../lib/admin/publication";
test("legacy paragraphs adapt without loss; unsafe content is rejected", () => {
  const d = legacyDocument(["First", "Second <script>literal</script>"]);
  expect(richTextPlain(validateRichText(d, true))).toBe(
    "First\nSecond <script>literal</script>",
  );
  for (const doc of [
    { type: "doc", content: [{ type: "iframe" }] },
    { type: "doc", content: [{ type: "paragraph", attrs: { style: "x" } }] },
  ])
    expect(() => validateRichText(doc)).toThrow();
  expect(() => validateRichText(legacyDocument(""), true)).toThrow("required");
});
test("paragraph indentation survives serialization without changing plain text", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { size: "large", indent: 2 },
        content: [{ type: "text", text: "Indented body" }],
      },
      {
        type: "paragraph",
        attrs: { indent: 0 },
        content: [{ type: "text", text: "Normal body" }],
      },
      {
        type: "paragraph",
        attrs: { indent: 6 },
        content: [{ type: "text", text: "Deepest body" }],
      },
    ],
  };
  expect(validateRichText(JSON.parse(JSON.stringify(doc)), true)).toEqual(doc);
  expect(richTextPlain(doc)).toBe("Indented body\nNormal body\nDeepest body");
});
test("indentation rejects out-of-range, fractional, string and misplaced attributes", () => {
  for (const indent of [-1, 7, 1.5, "2", null, true, Infinity])
    expect(() =>
      validateRichText({
        type: "doc",
        content: [{ type: "paragraph", attrs: { indent } }],
      }),
    ).toThrow("indentation");
  for (const type of [
    "doc",
    "bulletList",
    "orderedList",
    "listItem",
    "text",
    "hardBreak",
  ])
    expect(() => validateRichText({ type, attrs: { indent: 1 } })).toThrow();
});
test("published requires positive integer; drafts always use zero", () => {
  const f = new FormData();
  f.set("sort_order", "99");
  expect(publicationPosition(f)).toBe(0);
  f.set("published", "on");
  for (const v of ["", "0", "-1", "1.5", "Infinity"]) {
    f.set("sort_order", v);
    expect(() => publicationPosition(f)).toThrow();
  }
  f.set("sort_order", "1");
  expect(publicationPosition(f)).toBe(1);
});
