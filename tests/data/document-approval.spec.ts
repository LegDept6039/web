import { test, expect } from "@playwright/test";
import { parseLegislative } from "../../lib/legislative/validation";
import { decodeRecord } from "../../lib/content/schema";
import { readSupabaseCollection } from "../../lib/content/supabase";

function documentForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: "A collective council decision",
    number: "001",
    date_approved: "2026-11-18",
    year: "2026",
    summary: "The full document body.",
    committee_id: "finance",
    session_id: "session",
  }))
    form.set(key, value);
  return form;
}

for (const collection of ["ordinances", "resolutions"] as const) {
  test(`${collection}: mass motion creates and switches without invented authors`, () => {
    const form = documentForm();
    form.set("approval_mode", "mass_motion");
    const created = parseLegislative(collection, form, null);
    expect(created).toMatchObject({
      approval_mode: "mass_motion",
      author_id: null,
      co_author_id: null,
      author: "",
      co_author: null,
      published: true,
    });
    const changed = parseLegislative(collection, form, {
      id: "existing",
      published: true,
      sort_order: 9,
      author_id: "author",
      co_author_id: "coauthor",
      author: "Legacy author",
      co_author: "Legacy coauthor",
    });
    expect(changed).toMatchObject({
      id: "existing",
      sort_order: 9,
      author_id: null,
      co_author_id: null,
      author: "",
      co_author: null,
      approval_mode: "mass_motion",
    });
    form.delete("approval_mode");
    expect(parseLegislative(collection, form, changed).approval_mode).toBe(
      "mass_motion",
    );
    form.set("approval_mode", "authored");
    expect(() => parseLegislative(collection, form, changed)).toThrow(
      "Choose an author",
    );
    form.set("author_id", "author");
    expect(parseLegislative(collection, form, changed)).toMatchObject({
      approval_mode: "authored",
      author_id: "author",
      co_author_id: null,
    });
  });

  test(`${collection}: authored defaults and contradictory requests stay validated`, () => {
    const form = documentForm();
    expect(() => parseLegislative(collection, form, null)).toThrow(
      "Choose an author",
    );
    form.set("author_id", "author");
    expect(parseLegislative(collection, form, null).approval_mode).toBe(
      "authored",
    );
    form.set("co_author_id", "author");
    expect(() => parseLegislative(collection, form, null)).toThrow(
      "different officials",
    );
    form.set("approval_mode", "mass_motion");
    expect(() => parseLegislative(collection, form, null)).toThrow(
      "cannot have an individual author",
    );
    form.delete("author_id");
    expect(() => parseLegislative(collection, form, null)).toThrow(
      "cannot have an individual author",
    );
    form.delete("co_author_id");
    form.set("approval_mode", "all_authors");
    expect(() => parseLegislative(collection, form, null)).toThrow(
      "approval method",
    );
    form.set("approval_mode", "mass_motion");
    form.append("approval_mode", "authored");
    expect(() => parseLegislative(collection, form, null)).toThrow(
      "one approval method",
    );
  });

  test(`${collection}: public adapter retains collective approval and existing authored text`, async () => {
    const row = {
      id: "collective",
      title: "Collective decision",
      number: "001",
      date_approved: "2026-11-18",
      year: 2026,
      summary: "Full body",
      author: "",
      co_author: null,
      author_id: null,
      co_author_id: null,
      approval_mode: "mass_motion",
      status: "Approved",
      is_sample: false,
    };
    const records = await readSupabaseCollection(
      collection,
      {
        url: "https://example.supabase.co",
        key: "sb_publishable_test",
      },
      async (url) => {
        expect(new URL(url).searchParams.get("select")).toContain(
          "approval_mode",
        );
        return Response.json([row], { headers: { "content-range": "0-0/1" } });
      },
    );
    expect(records[0]).toMatchObject({
      approvalMode: "mass_motion",
      author: "",
    });
    expect(records[0].coAuthor).toBeUndefined();
    expect(
      decodeRecord(collection, {
        ...row,
        approval_mode: "authored",
        author: "Historical Author",
      }),
    ).toMatchObject({ approvalMode: "authored", author: "Historical Author" });
    expect(() =>
      decodeRecord(collection, { ...row, approval_mode: "unknown" }),
    ).toThrow("approval_mode");
  });
}
