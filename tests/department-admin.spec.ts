import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
const mho = "10000000-0000-4000-8000-000000000005",
  menro = "10000000-0000-4000-8000-000000000006",
  accounting = "10000000-0000-4000-8000-000000000007",
  legislative = "10000000-0000-4000-8000-000000000004";
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
test("ACCOUNTING sidebar and dashboard have only office-appropriate collections", async ({
  page,
}, info) => {
  await login(page, "accounting");
  await page.goto(`/admin/content?office=${accounting}`);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", {
    name: "Administration",
    exact: true,
  });
  await expect(
    nav.getByRole("button", { name: "ACCOUNTING", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Office overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(nav).not.toContainText("Executive /");
  await expect(page.locator("main .staff-grid h2")).toHaveText([
    "Contacts",
    "News",
    "Services",
    "Department Page",
    "Programs",
  ]);
  for (const collection of [
    "officials",
    "ordinances",
    "resolutions",
    "sessions",
    "committees",
    "hearings",
    "documents",
    "documentCategories",
  ]) {
    await page.goto(`/admin/content/${collection}?office=${accounting}`);
    await expect(
      page.getByText("PAGE NOT FOUND", { exact: true }),
    ).toBeVisible();
  }
});
test("Legislative sidebar is one entry and its dashboard contains the modules", async ({
  page,
}, info) => {
  await login(page, "secretary");
  await page.goto(`/admin/content?office=${legislative}`);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", {
    name: "Administration",
    exact: true,
  });
  await expect(
    nav.getByRole("link", { name: "Legislative Access", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Ordinances", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator("main")
      .getByRole("heading", { name: "Ordinances", exact: true }),
  ).toBeVisible();
});
test("MHO profile photo, owned news/programs, forged office rejection and public department isolation", async ({
  page,
}, info) => {
  const slug = `mho-${info.project.name}`,
    title = `MHO awareness ${info.project.name}`;
  const photo = await sharp("public/images/logos/seal.png")
    .resize(80, 80)
    .png()
    .toBuffer();
  await page.route("https://fixture.supabase.test/storage/**", (r) =>
    r.fulfill({ contentType: "image/png", body: photo }),
  );
  await page.route("**/_next/image**", (r) =>
    r.fulfill({ contentType: "image/png", body: photo }),
  );
  await login(page, "mho");
  await page.goto("/admin/content/departments/edit/test-menro");
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await page.goto(`/admin/content/departments/edit/test-mho?office=${mho}`);
  await page
    .getByRole("textbox", { name: "Head Name (optional)", exact: true })
    .fill("Dr. Test Health");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Community health care and preventive services.");
  await page.locator('textarea[name="body"]').fill("");
  await page
    .locator('input[name="photo"]')
    .setInputFiles({ name: "head.png", mimeType: "image/png", buffer: photo });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/departments\?/);
  await page.goto(`/admin/content/news/new?office=${mho}`);
  await expect(page.locator('form [name="category"]')).toHaveCount(0);
  await expect(page.locator('select[name="office_id"]')).toHaveCount(0);
  await expect(page.locator('input[name="office_id"]')).toHaveValue(mho);
  for (const [name, value] of Object.entries({
    slug,
    title,
    date: "2026-10-02",
    excerpt: "MHO information",
    content: "Public health awareness article.",
  }))
    await (
      name === "content"
        ? page.getByRole("textbox", { name: "Content", exact: true })
        : page.locator(`form [name="${name}"]`)
    ).fill(value);
  await page.locator('input[name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.locator('input[name="office_id"]').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, menro);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText(
    "You do not have permission",
  );
  // React resets an uncontrolled action form after its response; refill for the valid submission.
  for (const [name, value] of Object.entries({
    slug,
    title,
    date: "2026-10-02",
    excerpt: "MHO information",
    content: "Public health awareness article.",
  }))
    await (
      name === "content"
        ? page.getByRole("textbox", { name: "Content", exact: true })
        : page.locator(`form [name="${name}"]`)
    ).fill(value);
  await page.locator('input[name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.locator('input[name="office_id"]').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, mho);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/news\?/);
  await expect(page.getByRole("row").filter({ hasText: title })).toHaveCount(1);
  await expect(
    page.getByText("MENRO private draft", { exact: true }),
  ).toHaveCount(0);
  await page.goto(`/admin/content/programs/new?office=${mho}`);
  for (const [name, value] of Object.entries({
    slug,
    name: `MHO program ${info.project.name}`,
    description: "MHO vaccination services",
    category: "Health",
    status: "Active",
  }))
    await (
      name === "content"
        ? page.getByRole("textbox", { name: "Content", exact: true })
        : page.locator(`form [name="${name}"]`)
    ).fill(value);
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("MHO vaccination services");
  await page.locator('input[name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/programs\?/);
  await page.goto("/activities");
  await page
    .getByRole("combobox", { name: "Department", exact: true })
    .selectOption(mho);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Department", exact: true })
    .selectOption(menro);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.goto(`/news/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator(".article .news-source a")).toHaveAttribute(
    "href",
    "/departments/mho",
  );
  for (const url of ["/news", "/executive", "/departments/mho"]) {
    await page.goto(url);
    if (url === "/news") {
      await page
        .getByRole("combobox", { name: "Department", exact: true })
        .selectOption(mho);
      await expect(
        page.getByText("MENRO private draft", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page
          .locator(".news-card")
          .filter({ hasText: title })
          .locator(".news-source a"),
      ).toHaveAttribute("href", "/departments/mho");
    }
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Dr. Test Health", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".department-photo img")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: `MHO program ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator(".department-body")
      .getByText("Community health care and preventive services.", {
        exact: true,
      }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("department-profile.png"),
    fullPage: true,
  });
  await page.goto("/departments/menro");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("No news has been published by this department yet."),
  ).toBeVisible();
  await expect(
    page.getByText("No programs have been published by this department yet."),
  ).toBeVisible();
  await page.goto("/executive/departments");
  await expect(page).toHaveURL(/\/departments$/);
});
