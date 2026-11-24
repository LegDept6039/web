import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("editor");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
test("admin tab survives reload but a fresh tab cannot reuse the login", async ({
  page,
  context,
}) => {
  await login(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  const next = await context.newPage();
  await page.close();
  await next.goto("/admin");
  await expect(next).toHaveURL(/\/login$/);
  await expect(
    next.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
test("60 minutes of inactivity signs out and removes staff cookies", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await login(page);
  await page.clock.fastForward(61 * 60 * 1000);
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some((c) => c.name === "portal-staff-session"),
  ).toBe(false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("trusted admin interaction renews the inactivity countdown", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  await page.clock.fastForward(30 * 60 * 1000);
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/admin"),
    ),
    page.mouse.move(160, 160),
  ]);
  await page.clock.fastForward(31 * 60 * 1000);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(31 * 60 * 1000);
  await expect(page).toHaveURL(/\/login$/);
});
