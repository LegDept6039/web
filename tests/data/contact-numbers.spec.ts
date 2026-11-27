import { expect, test } from "@playwright/test";
import {
  contactNumberInput,
  editableContactNumber,
  normalizeContactNumber,
} from "../../lib/content/department-contact";
import { parseContent } from "../../lib/admin/content";
import { decodeRecord } from "../../lib/content/schema";
import { defaultMunicipalContact } from "../../lib/municipal-contact/defaults";
import {
  validateContactSettings,
  validateContactSettingsForSave,
} from "../../lib/municipal-contact/validation";

test("phone edits normalize numeric local and international formats to +63 and ten digits", () => {
  for (const value of [
    "9171234567",
    "+639171234567",
    "639171234567",
    "09171234567",
    " (+63) 917 123 4567 ",
    "0917-123-4567",
  ]) {
    expect(normalizeContactNumber("PHONE", value)).toBe("+639171234567");
    expect(contactNumberInput("PHONE", value)).toBe("9171234567");
    expect(editableContactNumber("PHONE", value)).toBe("9171234567");
  }
  for (const value of [
    "",
    "917123456",
    "91712345678",
    "+6391712345678",
    "abc9171234567",
    "+639171234567ext1",
    "９１７１２３４５６７",
    "+649171234567",
  ])
    expect(() => normalizeContactNumber("PHONE", value)).toThrow();
});

test("numeric inputs remove letters and separators, with a ten-digit phone limit", () => {
  expect(contactNumberInput("PHONE", "abc9171234567xyz")).toBe("9171234567");
  expect(contactNumberInput("PHONE", "917123456799")).toBe("9171234567");
  expect(contactNumberInput("LANDLINE", "(032) 468-9319abc")).toBe(
    "0324689319",
  );
  expect(contactNumberInput("LANDLINE", "+63 (32) 468 9319")).toBe(
    "63324689319",
  );
});

test("landline saves normalize conventional numeric formatting and reject letters", () => {
  expect(normalizeContactNumber("LANDLINE", "(032) 468-9319")).toBe(
    "0324689319",
  );
  expect(normalizeContactNumber("LANDLINE", "+63 32 468 9319")).toBe(
    "63324689319",
  );
  for (const value of [
    "",
    "call 0324689319",
    "0324689319 ext 2",
    "---",
    "1".repeat(101),
  ])
    expect(() => normalizeContactNumber("LANDLINE", value)).toThrow();
  expect(normalizeContactNumber("EMAIL", "office@example.test")).toBe(
    "office@example.test",
  );
});

function contactForm(type: string, value: string) {
  const form = new FormData();
  for (const [key, input] of Object.entries({
    office_id: "10000000-0000-4000-8000-000000000005",
    content_scope: "executive",
    type,
    value,
    sort_order: "1",
    published: "on",
  }))
    form.set(key, input);
  return form;
}

test("department contact authoring enforces number validation before persisted data is returned", () => {
  expect(
    parseContent("contacts", contactForm("PHONE", "0917 123 4567")).value,
  ).toBe("+639171234567");
  expect(
    parseContent("contacts", contactForm("LANDLINE", "(032) 468-9319")).value,
  ).toBe("0324689319");
  for (const [type, value] of [
    ["PHONE", "abc9171234567"],
    ["PHONE", "917123456"],
    ["LANDLINE", "0324689319abc"],
  ])
    expect(() => parseContent("contacts", contactForm(type, value))).toThrow();
});

test("public department and municipal decoders continue to read unchanged legacy values", () => {
  const legacy = "032 468 9319 ext 2";
  const row = Object.fromEntries(contactForm("LANDLINE", legacy));
  expect(
    decodeRecord("contacts", { ...row, id: "legacy-contact", is_sample: false })
      .value,
  ).toBe(legacy);
  expect(
    decodeRecord("contacts", {
      ...row,
      id: "legacy-phone",
      type: "PHONE",
      value: "Legacy telephone label",
      is_sample: false,
    }).value,
  ).toBe("Legacy telephone label");
  expect(
    validateContactSettings({ ...defaultMunicipalContact, telephone: legacy })
      .telephone,
  ).toBe(legacy);
  expect(editableContactNumber("LANDLINE", legacy)).toBe(legacy);
  expect(editableContactNumber("PHONE", "Legacy telephone label")).toBe(
    "Legacy telephone label",
  );
});

test("municipal telephone save rejects letters independently of legacy read validation", () => {
  expect(
    validateContactSettingsForSave({
      ...defaultMunicipalContact,
      telephone: " (032) 468-9319 ",
    }).telephone,
  ).toBe("0324689319");
  expect(
    validateContactSettingsForSave({
      ...defaultMunicipalContact,
      telephone: " ",
    }).telephone,
  ).toBeNull();
  expect(() =>
    validateContactSettingsForSave({
      ...defaultMunicipalContact,
      telephone: "0324689319abc",
    }),
  ).toThrow(/Letters are not allowed/);
});
