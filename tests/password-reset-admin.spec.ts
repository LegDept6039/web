import { test, expect, type Page, type TestInfo } from "@playwright/test";

const originalPassword = "TestPassword123!";
const newPassword = "PrivateReplacement123!";
const mho = "10000000-0000-4000-8000-000000000005";
const menro = "10000000-0000-4000-8000-000000000006";

function account(info: TestInfo, scenario: string) {
  const index =
    ["success", "expired", "replaced", "restricted", "disabled"].indexOf(
      scenario,
    ) + 1;
  const sequence = (info.project.name === "mobile" ? 10 : 0) + index;
  return {
    id: `70000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    email: `reset-${scenario}-${info.project.name}@example.test`,
    name: `Reset ${scenario} ${info.project.name}`,
  };
}

async function signIn(
  page: Page,
  email = "superadmin@example.test",
  password = originalPassword,
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function openReset(page: Page, target: ReturnType<typeof account>) {
  await page.goto(`/superadmin/users/${target.id}`);
  await page
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  const confirmation = page.locator(".staff-password-reset form");
  await expect(confirmation).toContainText(target.name);
  await expect(confirmation).toContainText(target.email);
  await expect(confirmation.locator('input[type="password"]')).toHaveCount(0);
  await confirmation.locator('[name="confirm_reset"]').check();
  return confirmation;
}

async function issueReset(page: Page, target: ReturnType<typeof account>) {
  const form = await openReset(page, target);
  await form
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  const secret = page.getByTestId("temporary-password");
  await expect(secret).toBeVisible();
  const password = (await secret.textContent())!;
  expect(password.length).toBeGreaterThanOrEqual(24);
  await expect(
    page.getByRole("button", { name: "Copy temporary password" }),
  ).toBeVisible();
  return password;
}

async function fillNewPassword(
  page: Page,
  password: string,
  confirmation = password,
) {
  await page.getByLabel("Enter new password", { exact: true }).fill(password);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill(confirmation);
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("temporary password requires a new password and preserves the original office access", async ({
  page,
  browser,
}, info) => {
  const target = account(info, "success");
  await signIn(page);
  await expect(page).toHaveURL(/\/superadmin$/);
  const temporary = await issueReset(page, target);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  await page.getByRole("button", { name: "Copy temporary password" }).click();
  await expect(
    page.getByText("Temporary password copied.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    temporary,
  );
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("reset-confirmation.png"),
    fullPage: true,
    mask: [page.locator(".staff-password-secret")],
    // Full-page mobile captures can reposition the overlay while resizing.
    // Hide the underlying secret for the screenshot as an additional safeguard.
    style:
      '[data-testid="temporary-password"] { color: transparent !important; text-shadow: none !important; }',
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("temporary-password")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("temporary-password")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Role", exact: true }),
  ).toHaveValue("editor");
  await expect(
    page.getByRole("listbox", { name: "Office Access", exact: true }),
  ).toHaveValues([mho]);
  await expect(page.locator('[name="active"]')).toBeChecked();

  const staffContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  try {
    const staff = await staffContext.newPage();
    await signIn(staff, target.email, temporary);
    await expect(staff).toHaveURL(/\/change-password$/);
    await expect(
      staff.getByRole("heading", {
        name: "Create a new password",
        exact: true,
      }),
    ).toBeVisible();
    await expect(staff.locator('input[name="current_password"]')).toHaveCount(
      0,
    );
    await expect(
      staff.getByRole("navigation", { name: "Administration" }),
    ).toHaveCount(0);
    await staff.goto("/admin/content");
    await expect(staff).toHaveURL(/\/change-password$/);
    await fillNewPassword(staff, newPassword, "DifferentPassword123!");
    await expect(staff.locator(".staff-error")).toContainText(
      "Passwords do not match",
    );
    await fillNewPassword(staff, temporary);
    await expect(staff.locator(".staff-error")).toContainText(
      /different from|temporary password/i,
    );
    await noOverflow(staff);
    await staff.screenshot({
      path: info.outputPath("create-new-password.png"),
      fullPage: true,
    });
    await fillNewPassword(staff, newPassword);
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
    await expect(
      staff.getByText(
        "Password updated. Please sign in with your new password.",
        { exact: true },
      ),
    ).toBeVisible();
    await signIn(staff, target.email, temporary);
    await expect(staff.locator(".staff-error")).toBeVisible();
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
    await signIn(staff, target.email, newPassword);
    await expect(staff).toHaveURL(/\/admin$/);
    await staff.goto(`/admin/content/departments/edit/${mho}?office=${mho}`);
    await expect(
      staff.getByRole("button", { name: "Save record", exact: true }),
    ).toBeVisible();
    await staff.goto(
      `/admin/content/departments/edit/${menro}?office=${menro}`,
    );
    await expect(
      staff.getByRole("button", { name: "Save record", exact: true }),
    ).toHaveCount(0);
    // The ordinary account password form shares the same serialization and
    // final sign-out behavior, without requiring a Superadmin-issued reset.
    await staff.goto("/account");
    await staff
      .getByLabel("Current password", { exact: true })
      .fill(newPassword);
    await staff.getByLabel("New password", { exact: true }).fill(newPassword);
    await staff
      .getByLabel("Confirm password", { exact: true })
      .fill(newPassword);
    await staff
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(staff.getByRole("status")).toContainText(
      "Choose a different password from your current password.",
    );
    await expect(staff).toHaveURL(/\/account$/);
    // Failed validation must leave the session usable for a corrected save.
    await staff
      .getByLabel("Current password", { exact: true })
      .fill(newPassword);
    await staff
      .getByLabel("New password", { exact: true })
      .fill("SelfServiceReplacement123!");
    await staff
      .getByLabel("Confirm password", { exact: true })
      .fill("SelfServiceReplacement123!");
    await staff
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
    await signIn(staff, target.email, "SelfServiceReplacement123!");
    await expect(staff).toHaveURL(/\/admin$/);
    await page.goto("/superadmin/audit");
    await expect(
      page.getByText("password_reset_started", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("password_reset_completed", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(temporary);
    await expect(page.locator("body")).not.toContainText(newPassword);
  } finally {
    await staffContext.close();
  }
});

test("expired and replaced temporary passwords cannot complete the reset", async ({
  page,
  browser,
}, info) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/superadmin$/);
  const staffContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  try {
    const staff = await staffContext.newPage();
    const expired = account(info, "expired");
    const expiredPassword = await issueReset(page, expired);
    await signIn(staff, expired.email, expiredPassword);
    await expect(staff.locator(".staff-error")).toContainText(
      /expired.*Superadmin/i,
    );
    await staff.goto("/admin");
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
    const replaced = account(info, "replaced");
    const first = await issueReset(page, replaced);
    await signIn(staff, replaced.email, first);
    await expect(staff).toHaveURL(/\/change-password$/);
    const second = await issueReset(page, replaced);
    expect(second).not.toBe(first);
    await fillNewPassword(staff, "AttemptWithStaleProof123!");
    // Issuing a replacement revoked the old Auth session. Wait for that
    // server redirect before interacting with the newly rendered login form.
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
    await expect(
      staff.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(
      staff.getByRole("navigation", { name: "Administration" }),
    ).toHaveCount(0);
    await signIn(staff, replaced.email, first);
    await expect(staff.locator(".staff-error")).toBeVisible();
    await signIn(staff, replaced.email, second);
    await expect(staff).toHaveURL(/\/change-password$/);
    await expect(
      staff.getByRole("button", { name: "Save password", exact: true }),
    ).toBeVisible();
  } finally {
    await staffContext.close();
  }
});

test("an already-open CMS session and a forged ordinary-staff reset request cannot bypass the restriction", async ({
  page,
  browser,
}, info) => {
  const target = account(info, "restricted");
  await signIn(page);
  await expect(page).toHaveURL(/\/superadmin$/);
  const staffContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  const attackerContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  try {
    const staff = await staffContext.newPage();
    await signIn(staff, target.email);
    await expect(staff).toHaveURL(/\/admin$/);
    await expect(
      staff.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    const confirmation = await openReset(page, target);
    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        Boolean(request.headers()["next-action"]),
    );
    await confirmation
      .getByRole("button", { name: "Reset Password", exact: true })
      .click();
    const request = await requestPromise;
    await expect(page.getByTestId("temporary-password")).toBeVisible();
    const temporary = (await page
      .getByTestId("temporary-password")
      .textContent())!;
    await staff.goto(`/admin/content/services?office=${mho}`);
    await expect(staff).toHaveURL(/\/(change-password|login)(?:\?|$)/);
    await expect(
      staff.getByRole("link", { name: "Add record", exact: true }),
    ).toHaveCount(0);
    const protectedResponse = await staff.request.get(
      `/admin/content/services?office=${mho}`,
      {
        maxRedirects: 0,
        headers: {
          Cookie: (await staffContext.cookies())
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join("; "),
        },
      },
    );
    expect([200, 303, 307]).toContain(protectedResponse.status());
    expect(await protectedResponse.text()).not.toContain("Add record");

    const attacker = await attackerContext.newPage();
    await signIn(attacker, "editor@example.test");
    await expect(attacker).toHaveURL(/\/admin$/);
    await attacker.goto(`/superadmin/users/${target.id}`);
    await expect(attacker).toHaveURL(/\/admin$/);
    const replay = await attacker.evaluate(
      async ({ url, body, action, contentType }) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Next-Action": action, "Content-Type": contentType },
          body,
        });
        return {
          text: await response.text(),
          redirect: response.headers.get("x-action-redirect"),
        };
      },
      {
        url: request.url(),
        body: request.postData()!,
        action: request.headers()["next-action"],
        contentType: request.headers()["content-type"],
      },
    );
    expect(replay.text).not.toContain("temporaryPassword");
    expect(replay.redirect || replay.text).toMatch(/\/admin|NEXT_REDIRECT/);

    if (
      await staff.getByRole("button", { name: "Sign out", exact: true }).count()
    )
      await staff
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
    await signIn(staff, target.email, temporary);
    await expect(staff).toHaveURL(/\/change-password$/);
    await fillNewPassword(staff, "RestrictedAccountNew123!");
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
    await signIn(staff, target.email, "RestrictedAccountNew123!");
    await expect(staff).toHaveURL(/\/admin$/);
  } finally {
    await staffContext.close();
    await attackerContext.close();
  }
});

test("resetting a disabled account never enables it", async ({
  page,
  browser,
}, info) => {
  const target = account(info, "disabled");
  await signIn(page);
  await expect(page).toHaveURL(/\/superadmin$/);
  const confirmation = await openReset(page, target);
  await confirmation
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  await expect(confirmation.getByRole("alert")).toContainText("disabled");
  await expect(page.getByTestId("temporary-password")).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[name="active"]')).not.toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Role", exact: true }),
  ).toHaveValue("editor");
  await expect(
    page.getByRole("listbox", { name: "Office Access", exact: true }),
  ).toHaveValues([mho]);
  const staffContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  try {
    const staff = await staffContext.newPage();
    await signIn(staff, target.email);
    await expect(staff.locator(".staff-error")).toContainText(
      /inactive|disabled/i,
    );
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
    await staff.goto("/admin");
    await expect(staff).toHaveURL(/\/login(?:\?|$)/);
  } finally {
    await staffContext.close();
  }
});
