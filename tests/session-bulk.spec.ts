import { test, expect, type Page } from "@playwright/test";

const office = "10000000-0000-4000-8000-000000000004";
const otherOffice = "10000000-0000-4000-8000-000000000005";
const term = "20000000-0000-4000-8000-000000000001";
const previous = "20000000-0000-4000-8000-000000000002";
async function login(page: Page, user = "vmo") {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`${user}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("#admin-navigation")).toBeAttached();
}
async function fill(
  page: Page,
  index: number,
  name: string,
  date: string,
  number: string,
) {
  const row = page.getByRole("group", {
    name: `Session ${index}`,
    exact: true,
  });
  await row.getByLabel("Date", { exact: true }).fill(date);
  await row.getByLabel("Name", { exact: true }).fill(name);
  await row.getByLabel("No. (Session Number)", { exact: true }).fill(number);
}

test("bulk add saves multiple published sessions in the selected historical term", async ({
  page,
}, info) => {
  await login(page);
  await page.goto(`/admin/content/sessions?office=${office}&term=${previous}`);
  await page
    .getByRole("link", { name: "Bulk add sessions", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Legislative Term", exact: true }),
  ).toHaveValue(previous);
  await fill(
    page,
    1,
    `Bulk regular ${info.project.name}`,
    "2024-10-01",
    `bulk-regular-${info.project.name}`,
  );
  await page
    .getByRole("button", { name: "Add another session", exact: true })
    .click();
  await fill(
    page,
    2,
    `Bulk special ${info.project.name}`,
    "2024-10-03",
    `bulk-special-${info.project.name}`,
  );
  await page
    .getByRole("group", { name: "Session 2", exact: true })
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("Special session");
  await page.getByLabel("Publish all sessions", { exact: true }).check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("bulk-session-form.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save 2 sessions", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `/admin/content/sessions\\?office=${office}&term=${previous}&created=2`,
    ),
  );
  await expect(page.getByRole("status")).toContainText(
    "2 sessions added successfully.",
  );
  for (const type of ["regular", "special"])
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: `Bulk ${type} ${info.project.name}` }),
    ).toContainText("Published");
  await page.goto(`/legislative/sessions?term=${previous}`);
  await expect(
    page.getByRole("heading", {
      name: `Bulk regular ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
});

test("bulk validation preserves rows, rejects mismatched terms and duplicates, and saves drafts", async ({
  page,
}, info) => {
  await login(page);
  await page.goto(`/admin/content/sessions/bulk?office=${office}&term=${term}`);
  await fill(
    page,
    1,
    `Bulk draft ${info.project.name}`,
    "2026-10-01",
    `draft-${info.project.name}`,
  );
  await page
    .getByRole("button", { name: "Add another session", exact: true })
    .click();
  await fill(page, 2, "Wrong term", "2024-10-02", `wrong-${info.project.name}`);
  await page.locator(".bulk-session-form").evaluate((form: HTMLFormElement) => {
    form.noValidate = true;
  });
  await page
    .getByRole("button", { name: "Save 2 sessions", exact: true })
    .click();
  await expect(page.locator(".staff-error")).toContainText(
    "Session 2: Date must be within the selected term",
  );
  await expect(
    page
      .getByRole("group", { name: "Session 1", exact: true })
      .getByLabel("Name", { exact: true }),
  ).toHaveValue(`Bulk draft ${info.project.name}`);
  await page
    .getByRole("button", { name: "Remove session 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save 1 session", exact: true })
    .click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `Bulk draft ${info.project.name}` }),
  ).toContainText("Draft");
  await expect(
    page.getByRole("row").filter({ hasText: "Wrong term" }),
  ).toHaveCount(0);
  await page.goto(`/legislative/sessions?term=${term}`);
  await expect(
    page.getByRole("heading", {
      name: `Bulk draft ${info.project.name}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto(`/admin/content/sessions/bulk?office=${office}&term=${term}`);
  await fill(page, 1, "Duplicate", "2026-10-01", `draft-${info.project.name}`);
  await page
    .getByRole("button", { name: "Save 1 session", exact: true })
    .click();
  await expect(page.locator(".staff-error")).toContainText(
    "already exists in this term",
  );
  // A valid row cannot turn a forged office or term into authority.
  await fill(page, 1, "Forged office", "2026-10-02", "forged");
  await page
    .locator('input[name="office_id"]')
    .evaluate((input: HTMLInputElement, value) => {
      input.value = value;
    }, otherOffice);
  await page
    .getByRole("button", { name: "Save 1 session", exact: true })
    .click();
  await expect(page.locator(".staff-error")).toContainText("editing access");
});

test("read-only and Executive-only users cannot enter bulk session creation", async ({
  page,
}) => {
  await login(page, "viewer");
  await page.goto(`/admin/content/sessions?office=${office}&term=${term}`);
  await expect(
    page.getByRole("link", { name: "Bulk add sessions", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/admin/content/sessions/bulk?office=${office}&term=${term}`);
  await expect(page.locator(".bulk-session-form")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Bulk add sessions", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "mho");
  await page.goto(`/admin/content/sessions/bulk?office=${office}&term=${term}`);
  await expect(page.locator(".bulk-session-form")).toHaveCount(0);
});
