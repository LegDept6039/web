import { test, expect } from "@playwright/test";
import { parseLegislative } from "../../lib/legislative/validation";

test("committee descriptions save, edit, clear and reject excessive length", () => {
  const form = new FormData();
  form.set("name", "Committee");
  form.set("master_id", "catalog-id");
  form.set("chair_id", "chair");
  form.set("vice_chair_id", "vice-chair");
  form.set("responsibility", "First responsibility\nSecond responsibility");
  const created = parseLegislative("committees", form, null);
  expect(created.responsibility).toBe(
    "First responsibility\nSecond responsibility",
  );
  form.set("responsibility", "a".repeat(500));
  expect(
    parseLegislative("committees", form, created).responsibility,
  ).toHaveLength(500);
  form.set("responsibility", "a".repeat(501));
  expect(() => parseLegislative("committees", form, created)).toThrow(
    "500 characters or fewer",
  );
  form.set("responsibility", "");
  expect(parseLegislative("committees", form, created).responsibility).toBe("");
  form.delete("responsibility");
  expect(parseLegislative("committees", form, created)).not.toHaveProperty(
    "responsibility",
  );
});

test("committee names and IDs are preserved; new compositions use UUIDs", () => {
  const form = new FormData();
  form.set("name", "Tourism and Heritage");
  form.set("master_id", "catalog-id");
  form.set("chair_id", "chair");
  form.set("vice_chair_id", "vice-chair");
  form.set("id", "forged-title-id");
  const legacy = parseLegislative("committees", form, {
    id: "finance",
    name: "Historical Name",
  });
  expect(legacy.id).toBe("finance");
  expect(legacy.name).toBe("Historical Name");
  const created = parseLegislative("committees", form, null);
  expect(created.id).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  form.set("name", "Renamed Committee");
  expect(parseLegislative("committees", form, created).id).toBe(created.id);
});

test("committee publication and ordering ignore omitted or forged client values", () => {
  const form = new FormData();
  form.set("master_id", "catalog-id");
  expect(parseLegislative("committees", form, null).published).toBe(true);
  form.set("published", "");
  form.set("sort_order", "-999");
  const existing = {
    id: "saved",
    name: "Saved committee",
    master_id: "catalog-id",
    published: true,
    sort_order: 7,
  };
  expect(parseLegislative("committees", form, existing)).toMatchObject({
    id: "saved",
    published: true,
    sort_order: 7,
  });
  expect(
    parseLegislative("committees", form, {
      ...existing,
      published: false,
      sort_order: 0,
    }),
  ).toMatchObject({
    published: true,
    sort_order: 1,
  });
});
