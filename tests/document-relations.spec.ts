import { test, expect } from "@playwright/test";
const office = "10000000-0000-4000-8000-000000000004";
test("member-only authors and same-date session matching survive saving and editing", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("vmo@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main .legislative-summary-grid").first()).toBeVisible();
  await page.goto(`/admin/content/ordinances/new?office=${office}`);
  await page.getByLabel("Date", { exact: true }).fill("2025-08-08");
  await expect(
    page.getByRole("status", { name: "Assigned Legislative Term", exact: true }),
  ).toHaveText("Current Council 2025-Current");
  await expect(
    page.getByRole("status", { name: "Session", exact: true }),
  ).toHaveText("6th Regular Session");
  for (const name of ["Author", "Co-author"]) {
    await expect(page.getByLabel(name, { exact: true })).not.toContainText(
      "Vice Mayor Test",
    );
    await expect(page.getByLabel(name, { exact: true })).toContainText(
      "Current Member A",
    );
  }
  await page
    .getByLabel("Title", { exact: true })
    .fill(`Automatic session ${info.project.name}`);
  await page
    .getByLabel("Document Number", { exact: true })
    .fill(`AUTO-${info.project.name}`);
  await page.getByLabel("Year", { exact: true }).fill("2025");
  await page
    .getByLabel("Author", { exact: true })
    .selectOption("term-current-a");
  await page
    .getByLabel("Co-author", { exact: true })
    .selectOption("term-current-b");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("term-committee");
  await page.getByLabel("Body", { exact: true }).fill("Document body.");
  await page.getByLabel("Date", { exact: true }).fill("2025-08-10");
  await expect(
    page.getByRole("status", { name: "Session", exact: true }),
  ).toHaveText("No matching session");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "No matching session",
  );
  await page.getByLabel("Date", { exact: true }).fill("2025-08-08");
  await page
    .getByLabel("Title", { exact: true })
    .fill(`Automatic session ${info.project.name}`);
  await page
    .getByLabel("Document Number", { exact: true })
    .fill(`AUTO-${info.project.name}`);
  await page.getByLabel("Year", { exact: true }).fill("2025");
  await page
    .getByLabel("Author", { exact: true })
    .selectOption("term-current-a");
  await page
    .getByLabel("Co-author", { exact: true })
    .selectOption("term-current-b");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("term-committee");
  await page.getByLabel("Body", { exact: true }).fill("Document body.");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: `Automatic session ${info.project.name}` })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(page.locator('input[name="session_id"]')).toHaveValue(
    "sixth-session",
  );
  await page.getByLabel("Date", { exact: true }).fill("2025-08-09");
  const session = page.getByRole("combobox", { name: "Session", exact: false });
  await expect(session).toHaveValue("");
  await session.selectOption("special-session");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  for (const type of ["agenda", "minutes"]) {
    await page.goto(
      `/admin/content/documents/new?office=${office}&type=${type}`,
    );
    await page.getByLabel("Date", { exact: true }).fill("2025-08-08");
    await expect(
      page.getByRole("status", { name: "Session", exact: true }),
    ).toHaveText("6th Regular Session");
    await expect(
      page.getByRole("status", { name: "Assigned Legislative Term", exact: true }),
    ).toHaveText("Current Council 2025-Current");
  }
  await page.screenshot({
    path: info.outputPath("automatic-session.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
