import { test, expect, type Page } from "@playwright/test";
const office = "10000000-0000-4000-8000-000000000004";
const current = "20000000-0000-4000-8000-000000000001";
const previous = "20000000-0000-4000-8000-000000000002";
async function signIn(page: Page, user: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`${user}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    user === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(page.locator("main .staff-grid").first()).toBeVisible();
}
async function save(page: Page, publish = false) {
  if (publish) {
    await page.getByLabel("Published", { exact: true }).check();
    await page.getByLabel("Sort order", { exact: true }).fill("1");
  }
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Record saved successfully",
  );
  await expect(page.locator("main .admin-table").first()).toBeVisible();
}
test("Superadmin catalog flows into each term and historical names survive catalog edits", async ({
  page,
}, info) => {
  const name = `Standing Committee ${info.project.name}`;
  await signIn(page, "superadmin");
  await page.goto("/superadmin/master-committees");
  await expect(page.locator("main tbody tr").nth(24)).toBeVisible();
  await page.getByLabel("Committee Name", { exact: true }).fill(name);
  await page.getByLabel("Sort Order", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Save committee", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Master committee saved.");
  await page.goto(`/admin/content/committees?office=${office}&term=${current}`);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Unassigned template");
  await row.getByRole("link", { name: "Edit composition" }).click();
  await expect(
    page.locator('select[name="master_id"] option:checked'),
  ).toHaveText(name);
  await expect(page.getByLabel("Committee Name", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Chairperson", { exact: true }),
  ).not.toContainText("Previous Member");
  await save(page); // Empty assignments and draft permitted.
  await expect(row).toContainText("Draft");
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Master Committee", exact: true }),
  ).toHaveValue(name);
  await expect(
    page.getByText("Saved historical name:", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByLabel("Chairperson", { exact: true })
    .selectOption("term-current-a");
  await page
    .getByLabel("Member 1", { exact: true })
    .selectOption("term-current-b");
  await save(page, true);
  await expect(row).toContainText("Current Member A");
  await expect(row).toContainText("Current Member B");
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expect(row).toContainText("Unassigned template");
  await row.getByRole("link", { name: "Edit composition" }).click();
  await expect(page.getByLabel("Chairperson", { exact: true })).toContainText(
    "Previous Member",
  );
  await expect(
    page.getByLabel("Chairperson", { exact: true }),
  ).not.toContainText("Current Member A");
  await save(page);
  await expect(page).toHaveURL(new RegExp(`term=${previous}`));
  await expect(row).toContainText("Draft");
  await page.goto("/superadmin/master-committees");
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit Master Committee", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Committee Name", { exact: true })).toHaveValue(
    name,
  );
  await page
    .getByLabel("Committee Name", { exact: true })
    .fill(`${name} Revised`);
  await page.getByLabel("Sort Order", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Save committee", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Master committee saved.");
  await expect(
    page.getByRole("cell", { name: `${name} Revised`, exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/content/committees?office=${office}&term=${current}`);
  await expect(row).toContainText(`Saved name: ${name}`);
  await page.screenshot({
    path: info.outputPath("committee-workspace.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/legislative/committees?term=${current}`);
  await expect(page.locator("summary").filter({ hasText: name })).toBeVisible();
  await expect(page.getByText(`${name} Revised`, { exact: true })).toHaveCount(
    0,
  );
  await page.goto(`/legislative/committees?term=${previous}`);
  await expect(page.locator("summary").filter({ hasText: name })).toHaveCount(
    0,
  );
});
test("Legislative editor manages composition but cannot manage catalog", async ({
  page,
}, info) => {
  await signIn(page, "legislative-editor");
  await page.goto("/superadmin/master-committees");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("main .staff-grid").first()).toBeVisible();
  await page.goto(`/admin/content/committees?office=${office}&term=${current}`);
  await expect(
    page.getByRole("link", { name: "Manage Master Committees" }),
  ).toHaveCount(0);
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", {
      name: `Committee ${info.project.name}`,
      exact: true,
    }),
  });
  await row.getByRole("link", { name: "Edit composition" }).click();
  await page
    .getByLabel("Chairperson", { exact: true })
    .selectOption("term-current-a");
  await save(page);
  await expect(row).toContainText("Current Member A");
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expect(row).toContainText("Unassigned template");
});
test("viewer sees compositions without write controls; Executive staff are denied", async ({
  page,
  browser,
}) => {
  await signIn(page, "viewer");
  await page.goto(`/admin/content/committees?office=${office}&term=${current}`);
  await expect(
    page.getByRole("link", { name: "Edit composition" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("row")
    .filter({ hasText: "Current Committee" })
    .getByRole("link", { name: "View", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save record", exact: true }),
  ).toHaveCount(0);
  const context = await browser.newContext();
  const other = await context.newPage();
  await signIn(other, "editor");
  await other.goto(`/admin/content/committees?office=${office}`);
  await expect(
    other.getByText("No access to this office.", { exact: true }),
  ).toBeVisible();
  await context.close();
});

test("historical committee can be associated without changing its name or edit URL", async ({
  page,
}, info) => {
  await signIn(page, "legislative-editor");
  await page.goto(`/admin/content/committees?office=${office}&term=unassigned`);
  const name = `Historical Committee ${info.project.name}`;
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/edit/legacy-${info.project.name}`));
  await page
    .locator('select[name="master_id"]')
    .selectOption(
      info.project.name === "desktop"
        ? "30000000-0000-4000-8000-000000000024"
        : "30000000-0000-4000-8000-000000000025",
    );
  await page.locator('select[name="term_id"]').selectOption(current);
  await page
    .getByLabel("Chairperson", { exact: true })
    .selectOption("term-current-b");
  await save(page);
  const row = page.getByRole("row").filter({ hasText: `Saved name: ${name}` });
  await expect(row).toContainText("Current Member B");
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/edit/legacy-${info.project.name}`));
  await expect(
    page.getByText(
      `Saved historical name: ${name}. This name is preserved for this term.`,
      { exact: true },
    ),
  ).toBeVisible();
});
