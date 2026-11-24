import { test, expect, type Page } from "@playwright/test";

const password = "TestPassword123!";
const office = "10000000-0000-4000-8000-000000000001";

async function signIn(page: Page, username: string, secret = password) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function fillAccount(page: Page, username: string, name: string) {
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("editor");
  await page.locator(`input[name="office"][value="${office}"]`).check();
}

test("existing accounts sign in with case-insensitive usernames and keep their assignments", async ({
  page,
}, info) => {
  await page.goto("/login");
  await expect(page.getByLabel("Username", { exact: true })).toHaveAttribute(
    "autocomplete",
    "username",
  );
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.getByText(/email address/i)).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("username-login.png"),
    fullPage: true,
  });
  await signIn(page, "EdItOr");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/account");
  await expect(page.locator("#main")).toContainText("Username: editor");
  await expect(page.locator("#main")).not.toContainText("@example.test");
  await page.goto("/admin/content/departments");
  await expect(page.getByText("MPDC draft", { exact: true })).toBeVisible();
  await expect(page.getByText("ASSESSOR draft", { exact: true })).toHaveCount(
    0,
  );
});

test("unknown usernames and wrong passwords have the same public failure", async ({
  page,
}) => {
  await signIn(page, "editor", "WrongPassword123!");
  const error = page.locator(".staff-error");
  await expect(error).toHaveText(
    "Unable to sign in. Invalid username or password.",
  );
  const wrongPasswordMessage = await error.textContent();
  await signIn(page, "unregistered.staff");
  await expect(error).toHaveText(wrongPasswordMessage!);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("Superadmin creates and renames a unique username without changing identity or access", async ({
  page,
  browser,
}, info) => {
  const username = `clerk-${info.project.name}`;
  const renamed = `${username}-new`;
  const name = `Username staff ${info.project.name}`;
  await signIn(page, "superadmin");
  await expect(page).toHaveURL(/\/superadmin$/);
  await page.goto("/superadmin/users/new");
  await expect(
    page.locator('input[type="email"], input[name="email"]'),
  ).toHaveCount(0);
  await fillAccount(page, username.toUpperCase(), name);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: username, exact: true }) });
  await expect(row).toContainText("MPDC");
  const href = await row.getByRole("link").getAttribute("href");
  expect(href).toMatch(/\/superadmin\/users\/[0-9a-f-]+$/);
  await expect(page.locator("#main")).not.toContainText(
    "@staff.pinamungajan.invalid",
  );
  expect(await page.content()).not.toContain("@staff.pinamungajan.invalid");

  await page.goto("/superadmin/users/new");
  await fillAccount(page, username.toUpperCase(), "Duplicate staff");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page.locator("#main").getByRole("alert")).toContainText(
    /username.*(already|use|taken)/i,
  );
  await page.goto("/superadmin/users");
  await expect(row).toHaveCount(1);
  await expect(
    page.getByRole("cell", { name: "Duplicate staff", exact: true }),
  ).toHaveCount(0);

  await page.goto(href!);
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    username,
  );
  expect(await page.content()).not.toContain("@staff.pinamungajan.invalid");
  await page.getByLabel("Username", { exact: true }).fill("editor");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("#main").getByRole("alert")).toContainText(
    /username.*(already|use|taken)/i,
  );
  await page.reload();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    username,
  );
  await expect(
    page.locator(`input[name="office"][value="${office}"]`),
  ).toBeChecked();
  await expect(page.locator('input[name="office"]:checked')).toHaveCount(1);
  await page.getByLabel("Username", { exact: true }).fill(renamed);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  const renamedRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: renamed, exact: true }) });
  await expect(renamedRow.getByRole("link")).toHaveAttribute("href", href!);
  await expect(renamedRow).toContainText("MPDC");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("username-account-list.png"),
    fullPage: true,
  });

  const staffContext = await browser.newContext({
    viewport: page.viewportSize(),
  });
  try {
    const staff = await staffContext.newPage();
    await signIn(staff, username);
    await expect(staff.locator(".staff-error")).toContainText(
      "Invalid username or password",
    );
    await signIn(staff, renamed);
    await expect(staff).toHaveURL(/\/admin$/);
    await staff.goto("/account");
    await expect(staff.locator("#main")).toContainText(`Username: ${renamed}`);
    await staff.goto("/admin/content/departments");
    await expect(staff.getByText("MPDC draft", { exact: true })).toBeVisible();
    await expect(
      staff.getByText("ASSESSOR draft", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await staffContext.close();
  }
});
