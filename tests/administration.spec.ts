import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    role === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
}
test("standalone login, invalid credentials, logout and protected routes", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator("header,footer")).toHaveCount(0);
  await page.getByLabel("Email address").fill("editor@example.test");
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText("Unable to sign in");
  await login(page, "editor");
  await page.reload();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("footer")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  for (const route of [
    "/admin",
    "/superadmin",
    "/superadmin/users",
    "/superadmin/offices",
    "/account",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});
test("editor sees only MPDC, cannot enter superadmin or unrelated records", async ({
  page,
}) => {
  await login(page, "editor");
  await expect(
    page.getByRole("link", { name: "Users & access control", exact: true }),
  ).toHaveCount(0);
  await page.goto("/superadmin/users");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/content/departments");
  await expect(page.getByText("MPDC draft", { exact: true })).toBeVisible();
  await expect(page.getByText("MAYOR draft", { exact: true })).toHaveCount(0);
  await page.goto("/admin/content/departments/edit/test-mpdc");
  await expect(
    page.getByRole("button", { name: "Save record", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Delete this record", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/content/departments/edit/test-mayor");
  await expect(
    page.getByRole("button", { name: "Save record", exact: true }),
  ).toHaveCount(0);
});
test("multi-office admin and read-only viewer", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/content/departments");
  await expect(page.getByText("MPDC draft", { exact: true })).toBeVisible();
  await expect(page.getByText("ASSESSOR draft", { exact: true })).toBeVisible();
  await expect(page.getByText("MAYOR draft", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "viewer");
  await page.goto("/admin/content/departments/edit/test-sb");
  await expect(page.getByText("View only", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save record", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(page.locator('textarea[name="description"]')).toBeDisabled();
});
test("superadmin creates user from website, assigns offices and resets password", async ({
  page,
}, testInfo) => {
  await login(page, "superadmin");
  await expect(
    page.getByRole("heading", { name: "Super Admin dashboard" }),
  ).toBeVisible();
  await expect(page.locator("footer")).toHaveCount(0);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Users & access control", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close menu", exact: true }).click();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("superadmin.png"),
    fullPage: true,
  });
  await page.goto("/superadmin/users/new");
  await page.getByLabel("Full name", { exact: true }).fill("New Staff");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`new-${testInfo.project.name}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("NewPassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("NewPassword123!");
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("editor");
  await page
    .getByRole("listbox", { name: "Office Access", exact: true })
    .selectOption("10000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  const row = page
    .getByRole("row")
    .filter({ hasText: `new-${testInfo.project.name}@example.test` });
  await expect(row).toContainText("MPDC");
  await row.getByRole("link").click();
  await page
    .locator("summary")
    .filter({ hasText: /^Reset password$/ })
    .click();
  await page
    .getByLabel("New password", { exact: true })
    .fill("ResetPassword123!");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("ResetPassword123!");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password reset.");
});
