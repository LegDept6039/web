import { test, expect, type Page } from "@playwright/test";

const mpdc = "10000000-0000-4000-8000-000000000001";
const assessor = "10000000-0000-4000-8000-000000000002";
const mayor = "10000000-0000-4000-8000-000000000003";
const lastOffice = "53000000-0000-4000-8000-000000000031";
const choice = (page: Page, value: string) =>
  page.locator(`input[name="office"][value="${value}"]`);

async function expectSelections(page: Page, values: string[]) {
  await expect(page.locator('input[name="office"]:checked')).toHaveCount(
    values.length,
  );
  for (const value of values) await expect(choice(page, value)).toBeChecked();
}

async function expectPageFlow(page: Page) {
  const tableWrap = page.locator(".account-office-table-wrap");
  await expect(tableWrap).toBeVisible();
  const measurement = await tableWrap.evaluate((element) => {
    const descendants = [element, ...element.querySelectorAll("*")];
    return {
      fitsWidth: element.scrollWidth <= element.clientWidth + 1,
      fitsHeight: element.scrollHeight <= element.clientHeight + 1,
      nestedScrollers: descendants.filter((node) => {
        const style = getComputedStyle(node);
        return (
          ((style.overflowY === "auto" || style.overflowY === "scroll") &&
            node.scrollHeight > node.clientHeight + 1) ||
          ((style.overflowX === "auto" || style.overflowX === "scroll") &&
            node.scrollWidth > node.clientWidth + 1)
        );
      }).length,
    };
  });
  expect(measurement).toEqual({
    fitsWidth: true,
    fitsHeight: true,
    nestedScrollers: 0,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
  ).toBe(true);
}

test("one office access table persists multiple assignments, deselection and Transparency without an internal scrollbar", async ({
  page,
}, info) => {
  const username = `office-checks-${info.project.name}`;
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("superadmin");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin$/);
  await page.goto("/superadmin/users/new");
  const group = page.getByRole("group", { name: "Office access", exact: true });
  await expect(group).toBeVisible();
  const table = page.getByRole("table", { name: "Office access", exact: true });
  await expect(table).toHaveCount(1);
  const checkboxCount = await group.getByRole("checkbox").count();
  expect(checkboxCount).toBeGreaterThan(25);
  await expect(table.locator("tbody tr")).toHaveCount(checkboxCount);
  expect(
    await table
      .locator("tbody tr")
      .evaluateAll((rows) =>
        rows.every(
          (row) => row.querySelectorAll('input[name="office"]').length === 1,
        ),
      ),
  ).toBe(true);
  await expect(
    page.locator(".account-form svg, .staff-password-reset svg"),
  ).toHaveCount(0);
  await expect(page.locator('select[name="office"]')).toHaveCount(0);
  await page
    .getByLabel("Full name", { exact: true })
    .fill(`Office checkbox staff ${info.project.name}`);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TestPassword123!");
  const role = page.getByRole("combobox", { name: "Role", exact: true });
  await role.selectOption("editor");
  await choice(page, mpdc).check();
  await choice(page, assessor).check();
  await choice(page, "transparency").check();
  await expectSelections(page, [mpdc, assessor, "transparency"]);
  await role.selectOption("superadmin");
  await expect(page.locator(".account-office-access")).toBeHidden();
  await expect(page.getByText(/Super Admin has .*access/i)).toBeVisible();
  await role.selectOption("editor");
  await expect(group).toBeVisible();
  await expectSelections(page, [mpdc, assessor, "transparency"]);
  await expectPageFlow(page);
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true }),
  ).toHaveAttribute("href", "/superadmin/users");
  await page.screenshot({
    path: info.outputPath("office-table-new.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: username, exact: true }) });
  await expect(row).toContainText("MPDC");
  await expect(row).toContainText("ASSESSOR");
  await expect(row).toContainText("Transparency");
  const href = await row.getByRole("link").getAttribute("href");
  await page.goto(href!);
  await expect(page.locator(".account-form table")).toHaveCount(1);
  await expect(
    page.getByRole("table", { name: "Office access", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".account-form svg, .staff-password-reset svg"),
  ).toHaveCount(0);
  await expectSelections(page, [mpdc, assessor, "transparency"]);
  await choice(page, assessor).uncheck();
  await choice(page, "transparency").uncheck();
  await choice(page, mayor).check();
  await choice(page, lastOffice).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  await expect(row).toContainText("MPDC");
  await expect(row).toContainText("MAYOR");
  await expect(row).toContainText("PD31");
  await expect(row).not.toContainText("ASSESSOR");
  await expect(row).not.toContainText("Transparency");
  await page.goto(href!);
  await expectSelections(page, [mpdc, mayor, lastOffice]);
  await expect(choice(page, assessor)).not.toBeChecked();
  await expect(choice(page, "transparency")).not.toBeChecked();
  await expectPageFlow(page);
  await page.screenshot({
    path: info.outputPath("office-table-edit.png"),
    fullPage: true,
  });
  await page
    .locator(".account-office-table-wrap")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: info.outputPath("office-table-viewport.png"),
  });
  await page
    .locator(".account-form-actions")
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.screenshot({
    path: info.outputPath("office-table-actions-viewport.png"),
  });
});
