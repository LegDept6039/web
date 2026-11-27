import { test, expect } from "@playwright/test";
import {
  serviceFormName,
  serviceFormPrefix,
  serviceFormSelection,
  validServiceFormPath,
  validStagedServiceFormPath,
} from "../../lib/admin/service-form-validation";

const office = "10000000-0000-4000-8000-000000000001";
const user = "20000000-0000-4000-8000-000000000001";
const other = "30000000-0000-4000-8000-000000000001";
const file = "40000000-0000-4000-8000-000000000001.pdf";
const path = serviceFormPrefix(office, user) + file;

test("service form staging is bound to the current user and owning office", () => {
  expect(validStagedServiceFormPath(path, office, user)).toBe(true);
  expect(validServiceFormPath(path, office)).toBe(true);
  for (const forged of [
    serviceFormPrefix(other, user) + file,
    serviceFormPrefix(office, other) + file,
    serviceFormPrefix(office, user) + "../" + file,
    path + "?copy=true",
    path.replace("services/", "legislative/"),
  ])
    expect(validStagedServiceFormPath(forged, office, user)).toBe(false);
  expect(validServiceFormPath(path, other)).toBe(false);
});

test("service form filenames preserve readable names and reject unsafe or oversized values", () => {
  expect(serviceFormName(" Application – resident.PDF ")).toBe(
    "Application – resident.PDF",
  );
  for (const name of [
    "",
    "not-a-pdf.docx",
    "../form.pdf",
    "folder\\form.pdf",
    "line\nform.pdf",
    "x".repeat(177) + ".pdf",
  ])
    expect(() => serviceFormName(name)).toThrow();
});

test("leaving the upload empty preserves trusted original values and ignores forged URLs", () => {
  const form = new FormData();
  form.set("form_path", serviceFormPrefix(other, user) + file);
  form.set("form_url", "https://example.test/forged.pdf");
  form.set("form_name", "forged.pdf");
  expect(
    serviceFormSelection(form, office, user, {
      form_path: path,
      form_name: "Original.pdf",
    }),
  ).toEqual({ form_path: path, form_name: "Original.pdf" });
  expect(serviceFormSelection(form, office, user, null)).toEqual({
    form_path: null,
    form_name: null,
  });
  form.set("remove_service_form", "on");
  expect(
    serviceFormSelection(form, office, user, {
      form_path: path,
      form_name: "Original.pdf",
    }),
  ).toEqual({ form_path: null, form_name: null });
});

test("replacement needs a validated staging reference and cannot be combined with removal", () => {
  const form = new FormData();
  form.set("service_form_upload_path", path);
  form.set("service_form_name", "New form.pdf");
  expect(serviceFormSelection(form, office, user, null)).toEqual({
    stagedPath: path,
    name: "New form.pdf",
  });
  form.set("remove_service_form", "on");
  expect(() => serviceFormSelection(form, office, user, null)).toThrow(
    "replacement",
  );
  form.delete("remove_service_form");
  form.set("service_form_upload_path", serviceFormPrefix(other, user) + file);
  expect(() => serviceFormSelection(form, office, user, null)).toThrow(
    "reference",
  );
});
