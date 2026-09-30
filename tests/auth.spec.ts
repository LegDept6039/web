import { test, expect } from "@playwright/test";
test("login is URL-only and anonymous admin routes are protected", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator('a[href="/login"], a[href="/admin"], a[href="/account"]'),
  ).toHaveCount(0);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const url of [
    "/admin",
    "/admin/users",
    "/admin/content/news",
    "/admin/content/news/new",
    "/admin/content/news/edit/example",
    "/account",
  ]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Staff sign in" }),
    ).toBeVisible();
  }
});
