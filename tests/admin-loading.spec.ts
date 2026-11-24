import { test, expect } from "@playwright/test";
const office = "10000000-0000-4000-8000-000000000001";
test("admin routes show skeletons while loading and replace them with usable content", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("editor");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("#admin-navigation")).toBeAttached();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Administration" });
  await nav.locator(".office-toggle").click();
  await nav.getByRole("link", { name: "News", exact: true }).click();
  const loading = page
    .locator("#main")
    .getByRole("status", { name: "Loading administration" });
  await expect(loading).toBeVisible();
  await expect(loading.locator(".skeleton-table-row")).toHaveCount(5);
  await expect(page.locator(".admin-sidebar")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("admin-table-loading.png"),
    fullPage: true,
  });
  await expect(page).toHaveURL(`/admin/content/news?office=${office}`);
  await expect(loading).toHaveCount(0);
  await page.getByRole("link", { name: /Add record/i }).click();
  await expect(loading.locator(".admin-skeleton-form")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(loading.locator(".skeleton").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("admin-form-loading.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "Add news record", exact: true }),
  ).toBeVisible();
  await expect(loading).toHaveCount(0);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await nav
    .getByRole("link", { name: "Department Page & Head", exact: true })
    .click();
  await expect(loading.locator(".admin-skeleton-form")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Edit department page", exact: true }),
  ).toBeVisible();
  await expect(loading).toHaveCount(0);
  await expect(page.locator('textarea[name="description"]')).toBeEditable();
});
