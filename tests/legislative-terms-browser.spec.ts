import { test, expect } from "@playwright/test";
const office = "10000000-0000-4000-8000-000000000004";
const current = "20000000-0000-4000-8000-000000000001",
  previous = "20000000-0000-4000-8000-000000000002";
test("homepage leadership shows only the current term before applying its card limit", async ({
  page,
}, info) => {
  await page.goto("/");
  const leadership = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Legislative leadership",
      exact: true,
    }),
  });
  const cards = leadership.locator(".official-card");
  // Four historical/unassigned officials sort ahead of current officials.
  // Filtering after the four-card limit would omit both current members.
  await expect(cards).toHaveCount(2);
  await expect(cards.getByRole("heading")).toHaveText([
    "Current Member A",
    "Current Member B",
  ]);
  await expect(leadership).not.toContainText("Previous Member");
  await expect(leadership).not.toContainText("Unassigned Member");
  await expect(leadership).not.toContainText("Legacy Member");
  await expect(leadership).not.toContainText("Draft Member");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await leadership.locator(".official-grid").screenshot({
    path: info.outputPath("homepage-current-council.png"),
  });

  await leadership.getByRole("link", { name: "Meet the council" }).click();
  await expect(page).toHaveURL(/\/legislative\/members$/);
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expect(
    page.getByRole("table", { name: "Council directory", exact: true }),
  ).toContainText("Previous Member");
  await expect(page.locator(".official-card")).toHaveCount(0);
});

test("legacy official opens from the historical list and keeps its ID after term assignment", async ({
  page,
}, info) => {
  const id = info.project.name === "mobile" ? "finance" : "committees";
  const name = `Legacy Member ${info.project.name}`;
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("vmo");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/content/officials?office=${office}&term=unassigned`);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(
    row.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveAttribute(
    "href",
    `/admin/content/officials/edit/${id}?office=${office}`,
  );
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit record", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
  await page.locator('select[name="term_id"]').selectOption(current);
  await expect(
    page.locator('select[name="term_id"] option:checked'),
  ).toHaveText("Current Council 2025-Current");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Renamed Historical Member");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Record saved successfully",
  );
  await expect(page.locator(".admin-table")).toBeVisible();
  await page.goto(`/admin/content/officials/edit/${id}?office=${office}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Renamed Historical Member",
  );
  await expect(page.locator('select[name="term_id"]')).toHaveValue(current);
  // Remove this isolated fixture record so roster/count tests remain independent.
  await page.getByText("Delete this record", { exact: true }).click();
  await page
    .getByLabel("Permanently delete this record", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.locator(".admin-table")).toBeVisible();
});

test("public terms show the current roster, historical roster and committee membership", async ({
  page,
}, info) => {
  await page.goto("/legislative/members");
  await expect(
    page
      .getByLabel("Legislative Term", { exact: true })
      .locator("option:checked"),
  ).toHaveText("Current Council 2025-Current");
  await expect(page.locator(".official-card")).toHaveCount(2);
  await expect(page.locator(".official-portrait")).toHaveCount(2);
  await expect(page.locator(".council-roster-table")).toHaveCount(0);
  await expect(
    page.getByText("Current Member A", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Draft Member", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("council-directory.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expect(
    page
      .getByLabel("Legislative Term", { exact: true })
      .locator("option:checked"),
  ).toHaveText("Previous Council 2022-2025");
  const roster = page.getByRole("table", {
    name: "Council directory",
    exact: true,
  });
  await expect(roster).toBeVisible();
  await expect(roster.getByRole("columnheader")).toHaveText([
    "Official",
    "Position",
  ]);
  await expect(roster.locator("tbody tr")).toHaveCount(1);
  await expect(roster.locator("tbody tr")).toContainText("Sangguniang Bayan");
  await expect(page.locator(".official-card, .official-portrait")).toHaveCount(
    0,
  );
  await expect(page.locator(".council-content img")).toHaveCount(0);
  await expect(
    page.getByText("Previous Member", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("historical-council-directory.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption("unassigned");
  await expect(
    page.getByText("Unassigned Member", { exact: true }),
  ).toBeVisible();
  await expect(roster).toBeVisible();
  await expect(
    page.locator(".official-card, .council-content img"),
  ).toHaveCount(0);
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(current);
  await expect(page.locator(".official-card")).toHaveCount(2);
  await expect(page.locator(".official-portrait")).toHaveCount(2);
  await expect(roster).toHaveCount(0);
  await page.goto("/legislative/committees");
  await expect(page.locator(".committee-entry")).toHaveCount(3);
  const currentCommittee = page.locator(".committee-entry").filter({
    has: page.getByRole("heading", { name: "Current Committee", exact: true }),
  });
  await currentCommittee.locator("summary").click();
  await expect(currentCommittee.locator(".committee-membership")).toContainText(
    "Current Member B",
  );
  await expect(
    page
      .locator(".committee-entry")
      .filter({
        hasNot: page.getByRole("heading", {
          name: "Current Committee",
          exact: true,
        }),
      })
      .filter({ hasText: "Current Member B" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("public-terms.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("staff forms filter relationships by term and dashboard counts follow selection", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("vmo");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.locator(".legislative-summary-grid .legislative-count").first(),
  ).toHaveText("3");
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expect(
    page.locator(".legislative-summary-grid .legislative-count").first(),
  ).toHaveText("1");
  await page.goto(`/admin/content/committees/new?office=${office}`);
  await expect(page).toHaveURL(
    new RegExp(`/admin/content/committees\\?office=${office}`),
  );
  await page
    .getByRole("row")
    .filter({ hasText: "Current Committee" })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(page.locator('select[name="term_id"]')).toHaveValue(current);
  await expect(
    page.locator('select[name="term_id"] option:checked'),
  ).toHaveText("Current Council 2025-Current");
  await expect(page.locator('select[name="chair_id"]')).not.toContainText(
    "Previous Member",
  );
  await page.locator('select[name="term_id"]').selectOption(previous);
  await expect(page.locator('select[name="chair_id"]')).toContainText(
    "Previous Member",
  );
  await expect(page.locator('select[name="chair_id"]')).not.toContainText(
    "Current Member",
  );
  await page.goto(`/admin/content/ordinances/new?office=${office}`);
  await expect(
    page
      .locator('fieldset input:not([type="hidden"]):not([type="file"])')
      .first(),
  ).toHaveAttribute("name", "date_approved");
  await page.getByLabel("Date", { exact: true }).fill("2024-11-16");
  await expect(
    page.getByRole("status", {
      name: "Assigned Legislative Term",
      exact: true,
    }),
  ).toHaveText("Previous Council 2022-2025");
  await expect(page.locator('select[name="author_id"]')).toContainText(
    "Previous Member",
  );
  await page.getByLabel("Date", { exact: true }).fill("2026-11-16");
  await expect(page.locator('select[name="author_id"]')).not.toContainText(
    "Previous Member",
  );
  await page.getByLabel("Date", { exact: true }).fill("2040-11-16");
  await expect(
    page.getByRole("status", {
      name: "Assigned Legislative Term",
      exact: true,
    }),
  ).toHaveText("No matching term");
  await page.goto(`/admin/content/documents/new?office=${office}&type=agenda`);
  await expect(
    page
      .locator('fieldset input:not([type="hidden"]):not([type="file"])')
      .first(),
  ).toHaveAttribute("name", "date");
  await page.getByLabel("Date", { exact: true }).fill("2024-11-16");
  await expect(
    page.getByRole("status", {
      name: "Assigned Legislative Term",
      exact: true,
    }),
  ).toHaveText("Previous Council 2022-2025");
  await expect(page.locator('input[name="session_id"]')).toHaveValue(
    "term-old-session",
  );
  await page.screenshot({
    path: info.outputPath("admin-term-form.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Superadmin creates and edits terms through the CMS", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("superadmin");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin$/);
  await page.goto("/superadmin/legislative-terms");
  await page
    .getByLabel("Term Name", { exact: true })
    .fill(`Future Council ${info.project.name}`);
  await page
    .getByLabel("Start Date", { exact: true })
    .fill(info.project.name === "mobile" ? "2034-07-01" : "2031-07-01");
  await page
    .getByLabel("End Date", { exact: true })
    .fill(info.project.name === "mobile" ? "2037-06-30" : "2034-06-30");
  await page.getByRole("button", { name: "Save term", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Term saved");
  const row = page
    .getByRole("row")
    .filter({ hasText: `Future Council ${info.project.name}` });
  await expect(row).toContainText("Upcoming");
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit Legislative Term", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Term Name", { exact: true })).toHaveValue(
    `Future Council ${info.project.name}`,
  );
  await page
    .getByLabel("Term Name", { exact: true })
    .fill(`Updated Council ${info.project.name}`);
  await page.getByRole("button", { name: "Save term", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `Updated Council ${info.project.name}` }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("terms-management.png"),
    fullPage: true,
  });
});

test("dated records save the actual-date term and recalculate when edited", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("vmo");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(
    `/admin/content/sessions/new?office=${office}&term=${current}`,
  );
  await expect(
    page
      .locator('fieldset input:not([type="hidden"]):not([type="file"])')
      .first(),
  ).toHaveAttribute("name", "date");
  await expect(page.locator('input[name="published"]')).toHaveCount(0);
  await expect(
    page.getByRole("spinbutton", { name: "Sort order", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Name", { exact: true })
    .fill(`Historical session ${info.project.name}`);
  await page.getByLabel("Date", { exact: true }).fill("2024-03-01");
  await page.getByLabel("No. (Session Number)", { exact: true }).fill("10");
  await page
    .getByLabel("Type", { exact: true })
    .selectOption("Regular session");
  await expect(
    page.getByRole("status", {
      name: "Assigned Legislative Term",
      exact: true,
    }),
  ).toHaveText("Previous Council 2022-2025");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/sessions\?saved=/);
  const id = new URL(page.url()).searchParams.get("saved");
  await page.goto(`/admin/content/sessions?office=${office}&term=${previous}`);
  await expect(page.locator(".admin-table")).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `Historical session ${info.project.name}` }),
  ).toContainText("Published");
  await page.goto(`/legislative/sessions?term=${previous}`);
  await expect(
    page.getByRole("heading", {
      name: `Historical session ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/admin/content/sessions/edit/${id}?office=${office}`);
  await expect(
    page.getByRole("status", {
      name: "Assigned Legislative Term",
      exact: true,
    }),
  ).toHaveText("Previous Council 2022-2025");
  await page.getByLabel("Date", { exact: true }).fill("2026-03-01");
  await expect(page.locator('input[name="published"]')).toHaveCount(0);
  // A stale client posting the old unchecked value cannot unpublish a session.
  await page.locator("form.staff-form.staff-card").evaluate((form) => {
    const published = document.createElement("input");
    published.type = "hidden";
    published.name = "published";
    published.value = "";
    form.append(published);
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/sessions\?saved=/);
  await expect(page.locator(".admin-table")).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `Historical session ${info.project.name}` }),
  ).toContainText("Published");
  const dates = await page
    .locator(".admin-table tbody tr td:nth-child(4)")
    .allTextContents();
  expect(dates.length).toBeGreaterThan(1);
  expect(dates).toEqual([...dates].sort().reverse());
  await page.goto(`/admin/content/sessions/edit/${id}?office=${office}`);
  await expect(
    page.getByRole("status", {
      name: "Assigned Legislative Term",
      exact: true,
    }),
  ).toHaveText("Current Council 2025-Current");
  await page.screenshot({
    path: info.outputPath("session-date-first.png"),
    fullPage: true,
  });
  for (const date of ["2026-11-01", "2026-02-01"]) {
    await page.goto(
      `/admin/content/documents/new?office=${office}&type=executive-order`,
    );
    await page.getByLabel("Date", { exact: true }).fill(date);
    await expect(
      page.getByRole("status", {
        name: "Assigned Legislative Term",
        exact: true,
      }),
    ).toHaveText("Current Council 2025-Current");
    await page
      .getByLabel("Title", { exact: true })
      .fill(`Date-order ${info.project.name} ${date}`);
    await page
      .getByLabel("Body", { exact: true })
      .fill("Executive order description.");
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.locator(".admin-table")).toBeVisible();
  }
  await page.goto(
    `/admin/content/documents?office=${office}&term=${current}&type=executive-order&q=Date-order+${info.project.name}`,
  );
  await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("date");
  await expect(page.locator(".admin-table tbody tr td:first-child")).toHaveText(
    [
      `Date-order ${info.project.name} 2026-11-01`,
      `Date-order ${info.project.name} 2026-02-01`,
    ],
  );
});
