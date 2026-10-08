import { test, expect } from "@playwright/test";

for (const [user, destination] of [
  ["superadmin", "/superadmin"],
  ["legislative-editor", "/admin"],
  ["editor", "/admin"],
]) {
  test(`active ${user} signs in with current access`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(`${user}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    if (user === "legislative-editor") {
      await page.goto("/admin/content/ordinances");
      await expect(
        page.getByRole("heading", { name: "Ordinances", exact: true }),
      ).toBeVisible();
    }
    if (user === "editor") {
      await page.goto("/admin/content/departments");
      await expect(page.getByText("MPDC draft", { exact: true })).toBeVisible();
      await expect(
        page.getByText("ASSESSOR draft", { exact: true }),
      ).toHaveCount(0);
      await page.goto("/admin/content/ordinances");
      await expect(
        page.getByText("PAGE NOT FOUND", { exact: true }),
      ).toBeVisible();
    }
  });
}

for (const [user, message] of [
  ["inactive", "inactive or removed"],
  ["missing-profile", "no staff profile is available"],
  ["no-membership", "no active department assignment"],
  ["profile-error", "staff profile could not be loaded (42501)"],
  ["membership-error", "department access could not be loaded (42501)"],
  ["invalid-role", "staff role is not recognized"],
  ["wrong-password", "Invalid email or password"],
]) {
  test(`${user} receives a specific denial and cannot retain staff access`, async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByLabel("Email address")
      .fill(`${user === "wrong-password" ? "editor" : user}@example.test`);
    await page
      .getByLabel("Password", { exact: true })
      .fill(
        user === "wrong-password" ? "WrongPassword123!" : "TestPassword123!",
      );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".staff-error")).toContainText(message);
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });
}

test("stale chunked refresh cookies are cleared and a new password login succeeds", async ({
  page,
  context,
}) => {
  const session =
    "base64-" +
    Buffer.from(
      JSON.stringify({
        access_token: "expired.fixture.token",
        refresh_token: "fixture-invalid-refresh",
        expires_at: 1,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "superadmin@example.test",
        },
      }),
    ).toString("base64url");
  const middle = Math.floor(session.length / 2);
  await context.addCookies([
    {
      name: "sb-fixture-auth-token.0",
      value: session.slice(0, middle),
      url: "http://127.0.0.1:3003",
      httpOnly: true,
    },
    {
      name: "sb-fixture-auth-token.1",
      value: session.slice(middle),
      url: "http://127.0.0.1:3003",
      httpOnly: true,
    },
    {
      name: "sb-other-auth-token",
      value: "unrelated-project",
      url: "http://127.0.0.1:3003",
    },
  ]);
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/login$/);
  const remaining = await context.cookies();
  expect(
    remaining.filter((c) => c.name.startsWith("sb-fixture-auth-token")),
  ).toHaveLength(0);
  expect(remaining.some((c) => c.name === "sb-other-auth-token")).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("superadmin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin$/);
  await page.reload();
  await expect(page).toHaveURL(/\/superadmin$/);
});
