import { test, expect } from "@playwright/test";
import {
  BulkSessionError,
  parseBulkSessions,
  BULK_SESSION_MAX_ROWS,
} from "../../lib/legislative/session-bulk";
import { parseLegislative } from "../../lib/legislative/validation";
import { parseContent } from "../../lib/admin/content";

const term = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "17th",
  start_date: "2025-07-01",
  end_date: "2028-06-30",
};
const session = {
  name: "1st Regular Session",
  number: "1",
  date: term.start_date,
  type: "Regular session",
};

test("bulk sessions always publish with the chosen term, inclusive dates, safe defaults and fresh identities", () => {
  const rows = parseBulkSessions(
    [
      {
        ...session,
        id: "forged",
        term_id: "forged",
        office_id: "forged",
        published: false,
        sort_order: 0,
      },
      { ...session, number: "2", date: term.end_date, type: "Special session" },
    ],
    term,
  );
  expect(rows).toHaveLength(2);
  expect(rows[0].id).not.toBe("forged");
  expect(rows[0].id).not.toBe(rows[1].id);
  for (const row of rows) {
    expect(row).toMatchObject({
      term_id: term.id,
      published: true,
      sort_order: 1,
      is_sample: false,
      agenda: [],
      description: "",
      image: "/images/department-placeholder.svg",
    });
    expect(row).not.toHaveProperty("office_id");
  }
  expect(parseBulkSessions([session], term)[0]).toMatchObject({
    published: true,
    sort_order: 1,
  });
});

test("single-session validation ignores draft flags and submitted ordering while preserving stored identity and position", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(session)) form.set(key, value);
  for (const flag of [undefined, "", "false", "on"]) {
    if (flag === undefined) form.delete("published");
    else form.set("published", flag);
    form.set("sort_order", "0");
    expect(parseLegislative("sessions", form, null)).toMatchObject({
      published: true,
      sort_order: 1,
    });
    expect(
      parseLegislative("sessions", form, {
        id: "saved-session",
        published: true,
        sort_order: 7,
      }),
    ).toMatchObject({ id: "saved-session", published: true, sort_order: 7 });
    expect(
      parseLegislative("sessions", form, {
        id: "historical-draft",
        published: false,
        sort_order: 0,
      }),
    ).toMatchObject({ id: "historical-draft", published: true, sort_order: 1 });
  }
});

test("generic legacy session validation also publishes without a publication field", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    ...session,
    id: "legacy-session",
    description: "Preserved session details",
    agenda: "Existing agenda",
    image: "/images/department-placeholder.svg",
    published: "false",
    sort_order: "0",
  }))
    form.set(key, value);
  expect(parseContent("sessions", form)).toMatchObject({
    id: "legacy-session",
    published: true,
    sort_order: 1,
  });
});

test("bulk sessions collect row errors and reject dates outside the selected term, invalid dates and repeated sessions", () => {
  try {
    parseBulkSessions(
      [
        session,
        { ...session, number: "2", date: "2025-06-30" },
        { ...session, number: "3", date: "2028-07-01" },
        { ...session, number: "4", date: "2026-02-30" },
        { ...session, number: " 1 " },
        { ...session, number: "5", type: "Caucus meeting" },
        { ...session, number: "6", name: "" },
      ],
      term,
    );
    throw new Error("Expected validation to reject the batch");
  } catch (error) {
    expect(error).toBeInstanceOf(BulkSessionError);
    expect((error as BulkSessionError).errors?.map((item) => item.row)).toEqual(
      [2, 3, 4, 5, 6, 7],
    );
  }
  // Separate sessions on the same date remain allowed.
  expect(
    parseBulkSessions([session, { ...session, type: "Special session" }], term),
  ).toHaveLength(2);
});

test("bulk sessions reject malformed and oversized batches", () => {
  for (const input of [
    null,
    {},
    [],
    [null],
    [{ ...session, date: 123 }],
    Array.from({ length: BULK_SESSION_MAX_ROWS + 1 }, () => session),
  ])
    expect(() => parseBulkSessions(input, term)).toThrow();
});
