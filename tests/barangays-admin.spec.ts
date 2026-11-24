import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

async function login(page: Page, role = "superadmin") {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(role);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    role === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(page.locator("#admin-navigation")).toBeAttached();
}
async function checkSquare(page: Page) {
  const frames = await page.locator(".barangay-image").evaluateAll((elements) =>
    elements.map((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    }),
  );
  expect(frames.length).toBeGreaterThan(0);
  for (const ratio of frames) expect(Math.abs(ratio - 1)).toBeLessThan(0.01);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("Superadmin creates, publishes and updates barangays with square images and formatted bodies", async ({
  page,
}, info) => {
  const name = `Fixture Barangay ${info.project.name}`;
  const slug = `fixture-barangay-${info.project.name}`;
  const png = await sharp({
    create: { width: 180, height: 80, channels: 3, background: "#285a8b" },
  })
    .png()
    .toBuffer();
  await page.route("**/_next/image**", (route) =>
    route.fulfill({ body: png, contentType: "image/png" }),
  );
  await login(page);
  await page.goto("/superadmin/barangays");
  await page.getByRole("link", { name: "Add barangay", exact: true }).click();
  await page.getByLabel("Barangay name", { exact: true }).fill(name);
  await expect(page.locator('[name="slug"]')).toHaveCount(0);
  // A forged field must not become the server-generated page address.
  await page.locator(".barangay-admin-form").evaluate((form) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "slug";
    input.value = "forged-address";
    form.append(input);
  });
  await page
    .getByLabel("Barangay captain", { exact: true })
    .fill("Fixture Captain");
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Community profile for residents.");
  await page.locator('input[name="image"]').setInputFiles({
    name: "barangay.png",
    mimeType: "image/png",
    buffer: png,
  });
  await checkSquare(page);
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  let row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Draft");
  await page.goto("/barangays");
  await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  await page.goto(`/barangays/${slug}`);
  await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  await page.goto("/superadmin/barangays");
  row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.locator('[name="slug"]')).toHaveCount(0);
  await page.getByLabel("Published", { exact: true }).check();
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Published community profile.");
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await page.goto("/barangays");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(
    page.locator(".barangay-captain").filter({ hasText: "Fixture Captain" }),
  ).toBeVisible();
  await checkSquare(page);
  await page.screenshot({
    path: info.outputPath("barangay-directory.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  const links = await page
    .locator(
      "#main-navigation > .nav-link, #main-navigation > .nav-dropdown > .nav-link",
    )
    .allTextContents();
  expect(links.findIndex((text) => text.trim() === "Barangays")).toBe(
    links.findIndex((text) => text.trim() === "Contact") - 1,
  );
  await page
    .getByRole("heading", { name, exact: true })
    .getByRole("link")
    .click();
  await expect(page.locator(".barangay-body")).toHaveText(
    "Published community profile.",
  );
  await expect(page.locator(".barangay-leadership")).toContainText(
    "Fixture Captain",
  );
  await checkSquare(page);
  await page.screenshot({
    path: info.outputPath("barangay-detail.png"),
    fullPage: true,
  });
  await page.goto("/superadmin/barangays");
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await page
    .getByLabel("Barangay captain", { exact: true })
    .fill("Updated Fixture Captain");
  await page
    .getByLabel("Barangay name", { exact: true })
    .fill(`Updated ${name}`);
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await page.goto(`/barangays/${slug}`);
  await expect(page.locator(".barangay-leadership")).toContainText(
    "Updated Fixture Captain",
  );
  await expect(
    page.getByRole("heading", { name: `Updated ${name}`, exact: true }),
  ).toBeVisible();
  await page.goto("/superadmin/barangays");
  await page
    .getByRole("row")
    .filter({ hasText: `Updated ${name}` })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Published", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await page.goto(`/barangays/${slug}`);
  await expect(
    page.getByRole("heading", { name: `Updated ${name}`, exact: true }),
  ).toHaveCount(0);
  // A second profile with the same normalized name receives its own address.
  await page.goto("/superadmin/barangays/new");
  await page.getByLabel("Barangay name", { exact: true }).fill(name);
  await page
    .getByLabel("Barangay captain", { exact: true })
    .fill("Second Captain");
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Second profile.");
  await page.getByLabel("Published", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name, exact: true }) })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View public page", exact: true }),
  ).toHaveAttribute("href", new RegExp(`^/barangays/${slug}-[0-9a-f]{8}$`));
});

test("ordinary staff cannot manage barangays, while Superadmin can save name-only profiles and invalid uploads preserve input", async ({
  page,
}, info) => {
  await login(page, "editor");
  await expect(
    page
      .locator("#admin-navigation")
      .getByRole("button", { name: "Barangays", exact: true }),
  ).toHaveCount(0);
  for (const route of [
    "/superadmin/barangays",
    "/superadmin/barangays/sk",
    "/superadmin/barangays/sk/new",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator("#admin-navigation")).toBeAttached();
  }
  await expect(
    page
      .locator("#admin-navigation")
      .getByRole("link", { name: "SK", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page);
  await page.goto("/superadmin/barangays/new");
  await page
    .getByLabel("Barangay name", { exact: true })
    .fill(`Validation Barangay ${info.project.name}`);
  await expect(
    page.getByLabel("Barangay captain", { exact: true }),
  ).not.toHaveAttribute("required", "");
  await expect(
    page.getByRole("textbox", { name: "Body", exact: true }),
  ).toHaveAttribute("aria-required", "false");
  await page.getByLabel("Published", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await page.goto(`/barangays/validation-barangay-${info.project.name}`);
  await expect(
    page.getByRole("heading", {
      name: `Validation Barangay ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".barangay-leadership")).toHaveCount(0);
  await expect(page.locator(".barangay-empty")).toContainText(
    "More information will be added soon.",
  );
  await page.screenshot({
    path: info.outputPath("name-only-barangay.png"),
    fullPage: true,
  });
  await page.goto("/superadmin/barangays");
  await page
    .getByRole("row")
    .filter({ hasText: `Validation Barangay ${info.project.name}` })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(
    page.getByLabel("Barangay captain", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Body", exact: true }),
  ).toHaveText("");
  await page.getByLabel("Barangay captain", { exact: true }).fill("Captain");
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Valid profile");
  await page.locator('input[name="image"]').setInputFiles({
    name: "forged.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page.locator(".staff-error")).toContainText(
    "valid, non-animated",
  );
  await expect(
    page.getByLabel("Barangay captain", { exact: true }),
  ).toHaveValue("Captain");
});

test("Barangays dropdown manages SK profiles with public visibility tied to the barangay", async ({
  page,
}, info) => {
  const name = `SK Community ${info.project.name}`;
  const slug = `sk-community-${info.project.name}`;
  const png = await sharp({
    create: { width: 180, height: 80, channels: 3, background: "#285a8b" },
  })
    .png()
    .toBuffer();
  await page.route("**/_next/image**", (route) =>
    route.fulfill({ body: png, contentType: "image/png" }),
  );
  const nav = page.locator("#admin-navigation");
  const toggle = nav.getByRole("button", { name: "Barangays", exact: true });
  async function openMenu() {
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    if (await menu.isVisible()) await menu.click();
  }
  async function openSK() {
    await openMenu();
    if ((await toggle.getAttribute("aria-expanded")) === "false")
      await toggle.click();
    await nav.getByRole("link", { name: "SK", exact: true }).click();
    await expect(page).toHaveURL(/\/superadmin\/barangays\/sk$/);
  }
  async function save() {
    await page
      .getByRole("button", { name: "Save SK profile", exact: true })
      .click();
    await expect(page).toHaveURL(/\/superadmin\/barangays\/sk\?saved=1$/);
  }
  async function edit() {
    await page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name, exact: true }) })
      .getByRole("link", { name: "Edit", exact: true })
      .click();
  }

  await login(page);
  await openMenu();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "SK", exact: true })).toHaveCount(
    0,
  );
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Barangay", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "SK", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("barangays-dropdown.png"),
    fullPage: true,
  });
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await nav.getByRole("link", { name: "Barangay", exact: true }).click();
  await page.getByRole("link", { name: "Add barangay", exact: true }).click();
  await page.getByLabel("Barangay name", { exact: true }).fill(name);
  await page
    .getByLabel("Barangay captain", { exact: true })
    .fill("Parent Captain");
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Barangay community profile.");
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await openSK();
  await openMenu();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "SK", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Barangay", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Add SK profile", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Barangay", exact: true })
    .selectOption({ label: `${name} (draft)` });
  await expect(page.locator('[name="slug"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save SK profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\/sk\?saved=1$/);
  await edit();
  await expect(page.getByLabel("SK chairperson", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("textbox", { name: "Body", exact: true }),
  ).toHaveText("");
  await page
    .getByLabel("SK chairperson", { exact: true })
    .fill("Fixture SK Chairperson");
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Youth leadership profile.");
  await page.getByLabel("Published", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save SK profile", exact: true })
    .click();
  await expect(page.locator(".staff-error")).toContainText(
    "Publish the linked barangay",
  );
  await page.getByLabel("Published", { exact: true }).uncheck();
  await page
    .locator('input[name="image"]')
    .setInputFiles({ name: "sk.png", mimeType: "image/png", buffer: png });
  await checkSquare(page);
  await page.locator(".sk-admin-form").evaluate((form) => {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "slug";
    field.value = "forged-sk";
    form.append(field);
    const duplicate = document.createElement("input");
    duplicate.type = "hidden";
    duplicate.name = "barangay_id";
    duplicate.value = "00000000-0000-4000-8000-000000000099";
    form.append(duplicate);
  });
  await save();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
    "Draft",
  );
  await page.goto(`/sk/${slug}`);
  await expect(
    page.getByRole("heading", { name: `SK ${name}`, exact: true }),
  ).toHaveCount(0);
  await page.goto("/superadmin/barangays");
  await edit();
  await page.getByLabel("Published", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await openSK();
  await edit();
  await page.getByLabel("Published", { exact: true }).check();
  await page
    .getByLabel("SK chairperson", { exact: true })
    .fill("Updated SK Chairperson");
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Published youth council profile.");
  await checkSquare(page);
  await page.screenshot({
    path: info.outputPath("sk-editor.png"),
    fullPage: true,
  });
  await save();
  await page.goto("/barangays");
  await page
    .getByRole("link", { name: "View SK directory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `SK ${name}`, exact: true }),
  ).toBeVisible();
  await checkSquare(page);
  await page
    .getByRole("heading", { name: `SK ${name}`, exact: true })
    .getByRole("link")
    .click();
  await expect(page.locator(".barangay-leadership")).toContainText(
    "Updated SK Chairperson",
  );
  await expect(page.locator(".barangay-body")).toHaveText(
    "Published youth council profile.",
  );
  await expect(
    page.getByRole("link", { name: `View Barangay ${name}`, exact: true }),
  ).toHaveAttribute("href", `/barangays/${slug}`);
  await checkSquare(page);
  await page.screenshot({
    path: info.outputPath("sk-detail.png"),
    fullPage: true,
  });
  await page.goto("/superadmin/barangays/sk/new");
  await page
    .getByRole("combobox", { name: "Barangay", exact: true })
    .selectOption({ label: name });
  await page
    .getByLabel("SK chairperson", { exact: true })
    .fill("Duplicate Chairperson");
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Duplicate profile.");
  await page
    .getByRole("button", { name: "Save SK profile", exact: true })
    .click();
  await expect(page.locator(".staff-error")).toContainText(
    "already has an SK profile",
  );
  await expect(page.getByLabel("SK chairperson", { exact: true })).toHaveValue(
    "Duplicate Chairperson",
  );
  await page.goto("/superadmin/barangays");
  await edit();
  await page.getByLabel("Published", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/barangays\?saved=1$/);
  await page.goto("/sk");
  await expect(
    page.getByRole("heading", { name: `SK ${name}`, exact: true }),
  ).toHaveCount(0);
  await page.goto(`/sk/${slug}`);
  await expect(
    page.getByRole("heading", { name: `SK ${name}`, exact: true }),
  ).toHaveCount(0);
});
