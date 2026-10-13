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
