import { test, expect } from "@playwright/test";
import { validateBiography } from "../../lib/content/department-biography";
import { parseContent } from "../../lib/admin/content";
test("biography accepts 800 characters, preserves paragraphs and rejects longer input without truncation", () => {
  const value = "First paragraph.\n\n" + "x".repeat(782);
  expect(value.length).toBe(800);
  expect(validateBiography(value)).toBe(value);
  expect(validateBiography(value.replaceAll("\n", "\r\n"))).toBe(value);
  expect(() => validateBiography(value + "x")).toThrow("800 characters");
  expect(value.length).toBe(800);
  const form = new FormData();
  form.set("head_description", "x".repeat(801));
  expect(() => parseContent("departments", form)).toThrow("800 characters");
});
