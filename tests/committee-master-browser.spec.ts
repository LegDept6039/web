import { test, expect, type Page } from "@playwright/test";
const office = "10000000-0000-4000-8000-000000000004";
const current = "20000000-0000-4000-8000-000000000001";
const previous = "20000000-0000-4000-8000-000000000002";
async function signIn(page: Page, user: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(user);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    user === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(
    page.locator("main .staff-grid, main .legislative-summary-grid").first(),
  ).toBeVisible();
}
async function save(page: Page) {
  await expect(page.locator('input[name="published"]')).toHaveCount(0);
  await expect(page.getByLabel("Sort order", { exact: true })).toHaveCount(0);
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
  await expect(row).toContainText("Published");
  await expect(
    row.getByRole("cell", { name: "Unassigned", exact: true }),
  ).toHaveCount(3);
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Master Committee", exact: true }),
  ).toHaveValue(name);
  await expect(page.getByLabel("Committee Name", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Chairperson", { exact: true }),
  ).not.toContainText("Previous Member");
  await save(page); // Empty assignments remain public, with no draft control.
  await expect(row).toContainText("Published");
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
  // An older form cannot force a draft or move its published position.
  await page.locator("form.staff-form.staff-card").evaluate((form) => {
    for (const [name, value] of [
      ["published", ""],
      ["sort_order", "-999"],
    ]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Record saved successfully",
  );
  await expect(row).toContainText("Published");
  await expect(row).toContainText("Current Member A");
  await expect(row).toContainText("Current Member B");
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expect(row).toContainText("Published");
  await expect(row).not.toContainText("Current Member A");
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Chairperson", { exact: true })).toContainText(
    "Previous Member",
  );
  await expect(
    page.getByLabel("Chairperson", { exact: true }),
  ).not.toContainText("Current Member A");
  await save(page);
  await expect(page).toHaveURL(new RegExp(`term=${previous}`));
  await expect(row).toContainText("Published");
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
  await expect(page.locator("summary").filter({ hasText: name })).toBeVisible();
});
test("Legislative editor manages composition but cannot manage catalog", async ({
  page,
}, info) => {
  await signIn(page, "legislative-editor");
  await page.goto("/superadmin/master-committees");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.locator("main .legislative-summary-grid").first(),
  ).toBeVisible();
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
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Chairperson", { exact: true })
    .selectOption("term-current-a");
  await save(page);
  await expect(row).toContainText("Current Member A");
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expect(row).toContainText("Published");
  await expect(row).not.toContainText("Current Member A");
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

test("historical committee cannot replace a generated composition or lose its identity", async ({
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
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText(
    "already has a composition for that term",
  );
  await expect(page).toHaveURL(new RegExp(`/edit/legacy-${info.project.name}`));
  await page.goto(`/admin/content/committees?office=${office}&term=unassigned`);
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
    "Published",
  );
});

test("a new term immediately has the complete published catalog without copied memberships", async ({
  page,
}, info) => {
  await signIn(page, "superadmin");
  await page.goto("/superadmin/master-committees");
  const catalogSummary = await page
    .getByRole("navigation", { name: "Master committee pages", exact: true })
    .innerText();
  const catalogCount = Number(catalogSummary.match(/of (\d+)/)?.[1]);
  expect(catalogCount).toBeGreaterThanOrEqual(25);
  await page.goto("/superadmin/legislative-terms");
  await page
    .getByLabel("Term Name", { exact: true })
    .fill(`Automatic Council ${info.project.name}`);
  await page
    .getByLabel("Start Date", { exact: true })
    .fill(info.project.name === "desktop" ? "2031-07-01" : "2034-07-01");
  await page
    .getByLabel("End Date", { exact: true })
    .fill(info.project.name === "desktop" ? "2034-06-30" : "2037-06-30");
  await page.getByRole("button", { name: "Save term", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Term saved");
  await page.goto(`/admin/content/committees?office=${office}`);
  const option = page
    .getByLabel("Legislative Term", { exact: true })
    .locator("option")
    .filter({ hasText: `Automatic Council ${info.project.name}` });
  const termId = await option.getAttribute("value");
  expect(termId).toBeTruthy();
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(termId!);
  const table = page.locator("main .admin-table").first();
  const pagination = page.getByRole("navigation", {
    name: "Committee pagination",
    exact: true,
  });
  await expect(pagination).toContainText(`of ${catalogCount}`);
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await expect(
    table.getByRole("cell", { name: "Published", exact: true }),
  ).toHaveCount(25);
  await expect(
    table.getByRole("cell", { name: "Unassigned", exact: true }),
  ).toHaveCount(75);
  await expect(
    table.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(25);
  await expect(
    page.getByRole("link", { name: "Edit composition", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Draft", { exact: true })).toHaveCount(0);
  if (catalogCount > 25) {
    await pagination.getByRole("link", { name: "Page 2", exact: true }).click();
    await expect(
      table.getByRole("cell", { name: "Published", exact: true }),
    ).toHaveCount(catalogCount - 25);
    await expect(
      table.getByRole("cell", { name: "Unassigned", exact: true }),
    ).toHaveCount((catalogCount - 25) * 3);
    await pagination.getByRole("link", { name: "Page 1", exact: true }).click();
    await expect(table.locator("tbody tr")).toHaveCount(25);
  }
  const currentRow = table.getByRole("row").filter({
    has: page.getByRole("cell", { name: "Current Committee", exact: true }),
  });
  const editUrl = await currentRow
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  await currentRow.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Chairperson", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("Chairperson", { exact: true }),
  ).not.toContainText("Current Member A");
  const masterId = await page.locator('input[name="master_id"]').inputValue();
  // Existing bookmarks to Add resolve to the generated record rather than a duplicate form.
  await page.goto(
    `/admin/content/committees/new?office=${office}&master=${masterId}&term=${termId}`,
  );
  await expect(page).toHaveURL(new URL(editUrl!, page.url()).href);
  // Existing deletion permissions remain unchanged. A specific bookmark can
  // restore a removed slot, while the ordinary Add URL stays on the workspace.
  await page.getByText("Delete this record", { exact: true }).click();
  await page
    .getByLabel("Permanently delete this record", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/content/committees\\?office=${office}`),
  );
  await page.goto(`/admin/content/committees?office=${office}&term=${termId}`);
  const missing = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "Current Committee", exact: true }),
  });
  await expect(missing).toContainText("Composition unavailable");
  await missing
    .getByRole("link", { name: "Restore composition", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Master Committee", exact: true }),
  ).toHaveValue(masterId);
  await expect(page.locator('select[name="term_id"]')).toHaveValue(termId!);
  await expect(page.getByLabel("Chairperson", { exact: true })).toHaveValue("");
  await save(page);
  await expect(
    page.getByRole("row").filter({ hasText: "Current Committee" }),
  ).toContainText("Published");
  await page.goto(`/legislative/committees?term=${termId}`);
  await expect(
    page.locator("summary").filter({ hasText: "Current Committee" }),
  ).toBeVisible();
});
