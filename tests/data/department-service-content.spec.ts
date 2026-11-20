import { expect, test } from "@playwright/test";
import { parseContent } from "../../lib/admin/content";
import { decodeRecord } from "../../lib/content/schema";
import {
  SERVICE_BODY_LIMIT,
  SERVICE_TITLE_LIMIT,
  serviceEditorBody,
  serviceExcerpt,
  validateService,
} from "../../lib/content/service";

const officeId = "10000000-0000-4000-8000-000000000005";
const body =
  "Bring your application.\nSubmit at the service desk.\n\nKeep your receipt.";

function serviceForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "  Application Assistance  ",
    body: `\n${body}\n`,
    office_id: officeId,
    content_scope: "executive",
    office: "Municipal Health Office",
    description: serviceExcerpt(body),
    icon: "file",
    steps: "",
    published: "on",
    sort_order: "1",
  }))
    form.set(key, value);
  return form;
}

test("service title and body enforce bounds without losing internal line breaks", () => {
  expect(validateService("  Application Assistance  ", `\n${body}\n`)).toEqual({
    name: "Application Assistance",
    body,
  });
  expect(
    validateService(
      "T".repeat(SERVICE_TITLE_LIMIT),
      "B".repeat(SERVICE_BODY_LIMIT),
    ),
  ).toEqual({ name: "T".repeat(300), body: "B".repeat(30000) });
  for (const title of ["", " \n\t ", "T".repeat(SERVICE_TITLE_LIMIT + 1)])
    expect(() => validateService(title, body)).toThrow(/service title/);
  for (const content of ["", " \n\t ", "B".repeat(SERVICE_BODY_LIMIT + 1)])
    expect(() => validateService("Application Assistance", content)).toThrow(
      /service body/,
    );
});

test("legacy service editing combines existing description and steps only when no body exists", () => {
  const legacy = {
    description: "Request assistance.",
    steps: ["Bring your ID.", "Submit your form.\nKeep a copy."],
  };
  expect(serviceEditorBody(legacy)).toBe(
    "Request assistance.\n\nBring your ID.\n\nSubmit your form.\nKeep a copy.",
  );
  expect(serviceEditorBody({ ...legacy, body: null })).toBe(
    serviceEditorBody(legacy),
  );
  expect(serviceEditorBody({ ...legacy, body })).toBe(body);
  expect(serviceEditorBody({})).toBe("");
  expect(legacy.steps).toEqual([
    "Bring your ID.",
    "Submit your form.\nKeep a copy.",
  ]);
});

test("new service parsing leaves ID generation to the database and retains body and ownership", () => {
  const form = serviceForm();
  form.set("id", "client-selected-id");
  const parsed = parseContent("services", form);
  expect(parsed).not.toHaveProperty("id");
  expect(parsed).toMatchObject({
    name: "Application Assistance",
    body,
    office_id: officeId,
    content_scope: "executive",
    steps: [],
    published: true,
    sort_order: 1,
    is_sample: false,
  });
  const generatedId = "20000000-0000-4000-8000-000000000006";
  expect(
    decodeRecord("services", { ...parsed, id: generatedId }),
  ).toMatchObject({
    id: generatedId,
    name: "Application Assistance",
    body,
    officeId,
    contentScope: "executive",
    steps: [],
  });
  expect(parsed).not.toHaveProperty("date");
});

test("editing service titles retains the existing ID and permits empty steps", () => {
  const form = serviceForm();
  form.set("original", "legacy-service");
  form.set("id", "legacy-service");
  form.set("name", "Updated Service Title");
  const parsed = parseContent("services", form);
  expect(parsed).toMatchObject({
    id: "legacy-service",
    name: "Updated Service Title",
    steps: [],
  });
  expect(decodeRecord("services", parsed)).toMatchObject({
    id: "legacy-service",
    name: "Updated Service Title",
    body,
    steps: [],
  });
  form.set("body", " \n ");
  expect(() => parseContent("services", form)).toThrow(/service body/);
});

test("service descriptions stay compact while legacy records decode without a body", () => {
  expect(serviceExcerpt(body)).toBe(
    "Bring your application. Submit at the service desk. Keep your receipt.",
  );
  const excerpt = serviceExcerpt("Long service details. ".repeat(30));
  expect(excerpt.length).toBeLessThanOrEqual(200);
  expect(excerpt).toMatch(/…$/);
  const parsed = parseContent("services", serviceForm());
  expect(
    decodeRecord("services", { ...parsed, id: "legacy-service", body: null }),
  ).not.toHaveProperty("body");
});
