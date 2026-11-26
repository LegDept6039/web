import { test, expect, type Page } from "@playwright/test";

const treasury = "97000000-0000-4000-8000-000000000001";
const market = "97000000-0000-4000-8000-000000000003";
const checkbox = 'input[name="show_head_photo_on_page"]';
const editContent = (id: string) => `/admin/content/departments/edit/${id}?office=${id}`;

async function login(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(username === "superadmin" ? /\/superadmin$/ : /\/admin$/);
  await expect(page.locator("main h1")).toBeVisible();
}

async function images(page: Page) {
  await page.route("**/_next/image**", route => route.fulfill({
    path: "public/images/logos/seal.png", contentType: "image/png",
  }));
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function detailWithoutPortrait(page: Page, slug: string, name: string) {
  await page.goto(`/departments/${slug}`);
  const profile = page.locator(".department-profile");
  await expect(profile.getByRole("heading", { name: `${name} officer`, exact: true })).toBeVisible();
  await expect(profile.locator(".department-biography")).toHaveText("Serving the municipality.");
  await expect(profile.locator(".department-photo")).toHaveCount(0);
  await expect(profile.locator("img, svg")).toHaveCount(0);
  await expect(profile).not.toContainText("OFFICIAL PROFILE");
  const fullWidth = await profile.evaluate(element => {
    const outer = element.getBoundingClientRect();
    const content = element.firstElementChild!.getBoundingClientRect();
    return Math.abs(content.width - outer.width) < 2 && Math.abs(content.left - outer.left) < 2;
  });
  expect(fullWidth).toBe(true);
  await noOverflow(page);
}

test("Superadmin can hide only the detail portrait and restore it without changing the directory image", async ({ page }, info) => {
  await images(page);
  await login(page, "superadmin");
  const editor = `/superadmin/departments/${treasury}`;
  await page.goto(editor);
  await expect(page.locator(checkbox)).toBeChecked();
  await expect(page.locator('input[name="head_photo_visibility_present"]')).toHaveValue("1");
  await page.locator(checkbox).uncheck();
  await page.getByRole("button", { name: "Save department", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  await page.goto(editor);
  await expect(page.locator(checkbox)).not.toBeChecked();
  await expect(page.getByAltText("Department Head Photo preview")).toHaveAttribute("src", /seal\.png/);

  // Old forms that do not carry the visibility marker preserve the stored choice.
  await page.locator('input[name="head_photo_visibility_present"]').evaluate(element => element.remove());
  await page.locator(checkbox).evaluate(element => element.remove());
  await page.getByRole("button", { name: "Save department", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  await page.goto(editor);
  await expect(page.locator(checkbox)).not.toBeChecked();

  await detailWithoutPortrait(page, "treasury", "Treasury");
  await page.locator(".department-profile").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("department-detail-hidden-portrait.png") });
  await page.goto("/departments");
  const card = page.locator(".department-directory-grid .department-card").filter({
    has: page.getByRole("heading", { name: "Treasury", exact: true }),
  });
  await expect(card.locator(".department-photo img")).toBeVisible();
  expect(decodeURIComponent((await card.locator("img").getAttribute("src")) || "")).toContain("/images/logos/seal.png");
  await noOverflow(page);
  await card.screenshot({ path: info.outputPath("directory-portrait-still-visible.png") });

  await page.goto(editor);
  await page.locator(checkbox).check();
  await page.getByRole("button", { name: "Save department", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  await page.goto("/departments/treasury");
  await expect(page.locator(".department-profile .department-photo img")).toBeVisible();
  await page.goto(editor);
  await expect(page.locator(checkbox)).toBeChecked();
});

test("assigned editors can save portrait visibility while viewers stay read-only and branch images remain visible", async ({ page }, info) => {
  await images(page);
  await login(page, "market-editor");
  await page.goto(editContent(market));
  await expect(page.locator(checkbox)).toBeChecked();
  await expect(page.locator(checkbox)).toBeEnabled();
  await page.locator(checkbox).uncheck();
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/branches/);
  await page.goto(editContent(market));
  await expect(page.locator(checkbox)).not.toBeChecked();
  await page.locator(checkbox).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("assigned-editor-photo-option.png") });
  await detailWithoutPortrait(page, "market-affairs", "Market Affairs");
  await expect(page.locator(".department-branch-image img")).toBeVisible();
  expect(decodeURIComponent((await page.locator(".department-branch-image img").getAttribute("src")) || "")).toContain("community.svg");
  await page.goto("/departments");
  const card = page.locator(".department-card").filter({
    has: page.getByRole("heading", { name: "Market Affairs", exact: true }),
  });
  await expect(card.locator(".department-photo img")).toBeVisible();
  expect(decodeURIComponent((await card.locator("img").getAttribute("src")) || "")).toContain("community.svg");

  await login(page, "branch-viewer");
  await page.goto(editContent(market));
  await expect(page.locator(checkbox)).not.toBeChecked();
  await expect(page.locator(checkbox)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save record", exact: true })).toHaveCount(0);

  await login(page, "market-editor");
  await page.goto(editContent(market));
  await page.locator(checkbox).check();
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/branches/);
  await page.goto("/departments/market-affairs");
  await expect(page.locator(".department-profile .department-photo img")).toBeVisible();
  await expect(page.locator(".department-branch-image img")).toBeVisible();
  await noOverflow(page);
});
