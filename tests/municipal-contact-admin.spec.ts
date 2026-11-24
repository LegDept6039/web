import { test, expect, type Page } from "@playwright/test";

const fields = [
  "municipality_name",
  "address",
  "telephone",
  "email",
  "office_hours",
  "social_label",
  "social_url",
  "map_embed_url",
] as const;
type ContactDraft = Record<(typeof fields)[number], string>;

async function login(page: Page, role = "superadmin") {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(role);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    role === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
}

async function draft(page: Page): Promise<ContactDraft> {
  return Object.fromEntries(
    await Promise.all(
      fields.map(async (field) => [
        field,
        await page.locator(`form [name="${field}"]`).inputValue(),
      ]),
    ),
  ) as ContactDraft;
}

async function fill(page: Page, values: Partial<ContactDraft>) {
  for (const [field, value] of Object.entries(values))
    await page.locator(`form [name="${field}"]`).fill(value);
}

async function save(page: Page) {
  await page
    .getByRole("button", { name: "Save contact details", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/contact\?saved=1$/);
  await expect(
    page.getByText("Municipal contact details saved.", { exact: true }),
  ).toBeVisible();
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test.beforeEach(async ({ context }) => {
  // Inspect embedding attributes without sending visitors' test traffic to Google.
  await context.route("https://www.google.com/maps/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>Fixture location map</body></html>",
    }),
  );
});

test.describe("Municipal contact settings", () => {
  let original: ContactDraft | undefined;
  test.beforeEach(async ({ page }) => {
    original = undefined;
    await login(page);
    await page.goto("/superadmin/contact");
    original = await draft(page);
  });
  test.afterEach(async ({ browser, page }) => {
    if (!original) return;
    // The singleton is shared by this transport process. Restore through the same
    // guarded form in an independently authenticated browser, even when a failed
    // assertion left the test page signed out. Staff sessions are tab-bound.
    const cleanupContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    try {
      const cleanupPage = await cleanupContext.newPage();
      cleanupPage.setDefaultTimeout(10000);
      cleanupPage.setDefaultNavigationTimeout(15000);
      await login(cleanupPage);
      await cleanupPage.goto("/superadmin/contact");
      await expect(
        cleanupPage.locator('form [name="municipality_name"]'),
      ).toBeVisible({ timeout: 10000 });
      await fill(cleanupPage, original);
      await save(cleanupPage);
    } finally {
      await cleanupContext.close();
    }
  });

  test("Superadmin saves municipal contacts and map for the public page", async ({
    page,
    context,
  }, info) => {
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Administration", exact: true })
        .getByRole("link", { name: "Municipal Contact", exact: true }),
    ).toBeVisible();
    if (info.project.name === "mobile")
      await page
        .getByRole("button", { name: "Close menu", exact: true })
        .click();

    const publicPage = await context.newPage();
    await publicPage.goto("/contact");
    const originalDirectory = await publicPage
      .locator(".department-contact-directory")
      .allTextContents();
    const values: ContactDraft = {
      municipality_name: `Pinamungajan Municipal Hall ${info.project.name}`,
      address: "Municipal Hall\nPinamungajan, Cebu\nPhilippines",
      telephone: "032 468 9319",
      email: "municipal-contact@example.test",
      office_hours: "Monday to Friday\n8:00 AM to 5:00 PM",
      social_label: "Official Municipal Updates",
      social_url: "https://example.test/municipality",
      map_embed_url:
        "https://www.google.com/maps/embed?pb=fixture-municipal-hall",
    };
    await fill(page, values);
    await noOverflow(page);
    await page.screenshot({
      path: info.outputPath("municipal-contact-form.png"),
      fullPage: true,
    });
    await save(page);
    await page.reload();
    expect(await draft(page)).toEqual(values);

    await publicPage.reload();
    const details = publicPage.locator(".municipal-contact-info");
    await expect(
      details.getByRole("heading", {
        name: values.municipality_name,
        exact: true,
      }),
    ).toBeVisible();
    await expect(details).toContainText(values.address.replaceAll("\n", " "));
    await expect(
      details.getByRole("link", { name: values.telephone, exact: true }),
    ).toHaveAttribute("href", /^tel:/);
    await expect(
      details.getByRole("link", { name: values.email, exact: true }),
    ).toHaveAttribute("href", `mailto:${values.email}`);
    await expect(details).toContainText("Monday to Friday");
    await expect(details).toContainText("8:00 AM to 5:00 PM");
    await expect(
      details.getByRole("link", { name: values.social_label, exact: true }),
    ).toHaveAttribute("href", values.social_url);
    const map = publicPage.locator("iframe.municipal-contact-map");
    await expect(map).toHaveAttribute("src", values.map_embed_url);
    await expect(map).toHaveAttribute(
      "title",
      `${values.municipality_name} Location Map`,
    );
    await expect(map).toHaveAttribute("loading", "lazy");
    await expect(map).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
    await expect(map).toHaveAttribute("allowfullscreen", "");
    await map.scrollIntoViewIfNeeded();
    await expect(map).toBeVisible();
    await noOverflow(publicPage);
    expect(
      await publicPage
        .locator(".department-contact-directory")
        .allTextContents(),
    ).toEqual(originalDirectory);
    await publicPage.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await publicPage.screenshot({
      path: info.outputPath("municipal-contact-public.png"),
      fullPage: true,
    });
    await publicPage.close();
  });

  test("invalid map URLs preserve drafts, and blank optional contacts stay hidden", async ({
    page,
    context,
  }) => {
    const draftName = "Municipal contact draft retained";
    await fill(page, { municipality_name: draftName });
    // Bypass browser type=url validation to exercise the server's checks too.
    await page.locator("form.staff-form").evaluate((form) => {
      (form as HTMLFormElement).noValidate = true;
    });
    for (const invalid of [
      "https://untrusted.example/maps/embed?pb=fixture",
      'javascript:alert("map")',
      '<iframe src="https://www.google.com/maps/embed?pb=fixture"></iframe>',
    ]) {
      await fill(page, { map_embed_url: invalid });
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname === "/superadmin/contact",
        ),
        page
          .getByRole("button", { name: "Save contact details", exact: true })
          .click(),
      ]);
      await expect(
        page.locator("form.staff-form").getByRole("alert"),
      ).toContainText(/Google Maps embed URL/);
      await expect(page.locator('[name="municipality_name"]')).toHaveValue(
        draftName,
      );
      await expect(page.locator('[name="map_embed_url"]')).toHaveValue(invalid);
    }
    const beforeSave = await context.newPage();
    await beforeSave.goto("/contact");
    await expect(
      beforeSave.locator(".municipal-contact-info").getByRole("heading", {
        name: original!.municipality_name,
        exact: true,
      }),
    ).toBeVisible();
    await beforeSave.close();
    await fill(page, {
      telephone: "",
      email: "",
      office_hours: "",
      social_label: "",
      social_url: "",
      map_embed_url: "",
    });
    await save(page);
    const publicPage = await context.newPage();
    await publicPage.goto("/contact");
    const details = publicPage.locator(".municipal-contact-info");
    await expect(
      details.getByRole("heading", { name: draftName, exact: true }),
    ).toBeVisible();
    await expect(
      details.getByRole("heading", {
        name: "Visit the Municipal Hall",
        exact: true,
      }),
    ).toBeVisible();
    for (const label of ["Telephone", "Email", "Office Hours", "Social Media"])
      await expect(
        details.getByRole("heading", { name: label, exact: true }),
      ).toHaveCount(0);
    await expect(
      publicPage.locator("iframe.municipal-contact-map"),
    ).toHaveCount(0);
    await noOverflow(publicPage);
    await publicPage.close();
  });

  test("a stale edit cannot overwrite a newer save", async ({
    page,
    browser,
  }) => {
    // A fresh tab intentionally cannot reuse staff login. Use another authenticated
    // browser session to model two legitimate editors without sharing tab cookies.
    const staleContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      viewport: page.viewportSize(),
    });
    try {
      const stalePage = await staleContext.newPage();
      await login(stalePage);
      await stalePage.goto("/superadmin/contact");
      await expect(stalePage.locator('[name="updated_at"]')).toHaveValue(
        await page.locator('[name="updated_at"]').inputValue(),
      );
      await fill(page, {
        municipality_name: "Latest municipal contact information",
      });
      await save(page);
      await fill(stalePage, {
        municipality_name: "Stale edit must not overwrite",
      });
      await stalePage
        .getByRole("button", { name: "Save contact details", exact: true })
        .click();
      await expect(
        stalePage.locator("form.staff-form").getByRole("alert"),
      ).toContainText(
        "These contact details changed since you opened this page. Reload before saving.",
      );
      await expect(stalePage.locator('[name="municipality_name"]')).toHaveValue(
        "Stale edit must not overwrite",
      );
      await page.reload();
      await expect(page.locator('[name="municipality_name"]')).toHaveValue(
        "Latest municipal contact information",
      );
    } finally {
      await staleContext.close();
    }
  });
});

test("non-Superadmin staff cannot open or find municipal contact management", async ({
  page,
}, info) => {
  for (const role of ["admin", "editor", "viewer"]) {
    await login(page, role);
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Administration", exact: true })
        .getByRole("link", { name: "Municipal Contact", exact: true }),
    ).toHaveCount(0);
    await page.goto("/superadmin/contact");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("button", { name: "Save contact details", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
  await page.goto("/superadmin/contact");
  await expect(page).toHaveURL(/\/login$/);
});
