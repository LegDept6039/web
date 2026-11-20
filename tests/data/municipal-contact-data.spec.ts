import { expect, test } from "@playwright/test";
import { defaultMunicipalContact } from "../../lib/municipal-contact/defaults";
import { validateContactSettings } from "../../lib/municipal-contact/validation";
import { readMunicipalContact } from "../../lib/municipal-contact/data";

const config = {
  url: "https://fixture.supabase.test",
  key: "sb_publishable_fixture",
};

test("contact fields preserve line breaks, normalize blanks and validate links", () => {
  const input = {
    ...defaultMunicipalContact,
    address: "  Municipal Hall\nPinamungajan, Cebu  ",
    telephone: "  ",
    email: " office@example.test ",
    social_url: "https://www.facebook.com/municipality",
  };
  expect(validateContactSettings(input)).toMatchObject({
    address: "Municipal Hall\nPinamungajan, Cebu",
    telephone: null,
    email: "office@example.test",
    map_embed_url: defaultMunicipalContact.map_embed_url,
  });
  for (const values of [
    { municipality_name: " " },
    { address: "x".repeat(1001) },
    { email: "not-an-email" },
    { social_url: "javascript:alert(1)" },
    { social_url: "https://user:pass@example.test" },
    {
      map_embed_url:
        '<iframe src="https://www.google.com/maps/embed?pb=valid"></iframe>',
    },
    { map_embed_url: "https://www.google.com.evil.test/maps/embed?pb=valid" },
    { map_embed_url: "https://www.google.com/maps/embed?pb=" },
    { map_embed_url: "https://www.google.com/maps/embed?pb=valid#fragment" },
  ])
    expect(() => validateContactSettings({ ...input, ...values })).toThrow();
});

test("public contact reads use the publishable key and fresh singleton data", async () => {
  let name = "First Name";
  const request = async (url: string, init: RequestInit) => {
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/rest/v1/municipal_contact_settings");
    expect(parsed.searchParams.get("id")).toBe("eq.municipal");
    expect(parsed.searchParams.get("limit")).toBe("1");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
    expect(new Headers(init.headers).get("apikey")).toBe(config.key);
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    return Response.json([
      { ...defaultMunicipalContact, municipality_name: name },
    ]);
  };
  expect((await readMunicipalContact(config, request))?.municipality_name).toBe(
    "First Name",
  );
  name = "Updated Name";
  expect((await readMunicipalContact(config, request))?.municipality_name).toBe(
    "Updated Name",
  );
});

test("missing contact setup returns no main section without substituting mock data", async () => {
  expect(
    await readMunicipalContact(config, async () => Response.json([])),
  ).toBeNull();
  expect(
    await readMunicipalContact(config, async () =>
      Response.json({ code: "PGRST205" }, { status: 404 }),
    ),
  ).toBeNull();
  await expect(
    readMunicipalContact(config, async () =>
      Response.json(
        { code: "42501", message: "private diagnostic" },
        { status: 403 },
      ),
    ),
  ).rejects.toThrow("Unable to load municipal contact information.");
});

test("unsafe or malformed public contact rows are rejected before rendering", async () => {
  for (const rows of [
    null,
    {},
    [{ ...defaultMunicipalContact, id: "another" }],
    [defaultMunicipalContact, defaultMunicipalContact],
    [{ ...defaultMunicipalContact, map_embed_url: "https://evil.test/embed" }],
  ]) {
    await expect(
      readMunicipalContact(config, async () => Response.json(rows)),
    ).rejects.toThrow();
  }
});
