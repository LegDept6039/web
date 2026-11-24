import { test, expect, type Page, type Locator } from "@playwright/test";

const treasury = "97000000-0000-4000-8000-000000000001";
const engineering = "97000000-0000-4000-8000-000000000002";
const market = "97000000-0000-4000-8000-000000000003";
const slaughter = "97000000-0000-4000-8000-000000000004";
const waterworks = "97000000-0000-4000-8000-000000000005";
const branchNames = ["Market Affairs", "Slaughter House", "Waterworks"];
const editContent = (id: string) => `/admin/content/departments/edit/${id}?office=${id}`;

async function login(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(username === "superadmin" ? /\/superadmin$/ : /\/admin$/);
  await expect(page.locator("main h1")).toBeVisible();
}

async function navigation(page: Page) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  return page.getByRole("navigation", { name: "Administration", exact: true });
}

async function noDuplicateActions(table: Locator) {
  for (const row of await table.locator("tbody tr").all()) {
    const links = row.locator(".admin-actions-cell a[href]");
    const destinations = await links.evaluateAll(elements => elements.map(element => {
      const value = new URL((element as HTMLAnchorElement).href);
      value.searchParams.sort(); return value.href;
    }));
    expect(new Set(destinations).size).toBe(destinations.length);
    for (const link of await links.all()) {
      const label = await link.getAttribute("aria-label");
      expect(label).toBeTruthy();
      await expect(link).toHaveAttribute("title", label!);
      await expect(link.locator("svg")).toHaveCount(1);
    }
  }
}

test("Superadmin manages departments and branches in separate lists and saves a branch through its canonical editor", async ({ page }, info) => {
  await login(page, "superadmin");
  const departmentSummary = Number((await page.locator('a.staff-card[href="/superadmin/departments"] p').first().innerText()).split(" ")[0]);
  const branchSummary = Number((await page.locator('a.staff-card[href="/superadmin/branches"] p').first().innerText()).split(" ")[0]);
  await page.goto("/superadmin/departments");
  await expect(page.locator("main h1")).toHaveText("Departments");
  const departments = page.locator("main table");
  await expect(departments.locator("tbody tr").filter({ hasText: "Treasury" })).toHaveCount(1);
  await expect(departments.locator("tbody tr").filter({ hasText: "Engineering" })).toHaveCount(1);
  for (const name of branchNames)
    await expect(departments.locator("tbody tr").filter({ hasText: name })).toHaveCount(0);
  await noDuplicateActions(departments);
  const departmentCount = await departments.locator("tbody tr").count();
  expect(departmentCount).toBe(departmentSummary);
  const nav = await navigation(page);
  await expect(nav.getByRole("link", { name: "Branches", exact: true })).toHaveAttribute("href", "/superadmin/branches");
  const offices = nav.locator(".offices-nav").filter({ has: page.locator(".admin-nav-label").filter({ hasText: /^Offices$/ }) });
  const branchGroup = nav.locator(".offices-nav").filter({ has: page.locator(".admin-nav-label").filter({ hasText: /^Branches$/ }) });
  await expect(offices.getByRole("button", { name: "TREASURY", exact: true })).toBeVisible();
  for (const name of ["MARKET", "SLAUGHTER", "WATERWORKS"]) {
    await expect(offices.getByRole("button", { name, exact: true })).toHaveCount(0);
    await expect(branchGroup.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath("superadmin-branch-sidebar.png") });
  await page.goto("/superadmin/branches");
  await expect(page.locator("main h1")).toHaveText("Branches");
  const branches = page.locator("main table");
  for (const name of branchNames)
    await expect(branches.locator("tbody tr").filter({ hasText: name })).toHaveCount(1);
  for (const [name, parent] of [["Market Affairs", "Treasury"], ["Slaughter House", "Treasury"], ["Waterworks", "Engineering"]])
    await expect(branches.locator("tbody tr").filter({ hasText: name }).getByRole("cell").nth(2)).toHaveText(parent);
  for (const id of [treasury, engineering])
    await expect(branches.locator(`a[href="/superadmin/branches/${id}"]`)).toHaveCount(0);
  const branchCount = await branches.locator("tbody tr").count();
  expect(branchCount).toBe(branchSummary);
  expect(branchCount).toBeGreaterThanOrEqual(3);
  await noDuplicateActions(branches);
  await page.screenshot({ path: info.outputPath("branches-management-list.png") });
  await page.goto(`/superadmin/departments/${market}`);
  await expect(page).toHaveURL(`/superadmin/branches/${market}`);
  await expect(page.locator("main h1")).toHaveText("Edit branch");
  await expect(page.locator('select[name="parent_department_id"]')).toHaveValue(treasury);
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/branches$/);

  await page.goto("/superadmin/branches/new");
  await expect(page.locator("main h1")).toHaveText("Add branch");
  const parent = page.locator('select[name="parent_department_id"]');
  await expect(parent).toHaveAttribute("required", "");
  await expect(parent.locator(`option[value="${market}"]`)).toHaveCount(0);
  const name = `Separate branch ${info.project.name}`;
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="short_name"]').fill("SEPARATE");
  await page.locator('input[name="slug"]').fill(`separate-branch-${info.project.name}`);
  await page.locator('textarea[name="description"]').fill("Managed in the separate Branches section.");
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/branches\/new$/);
  expect(await parent.evaluate(element => (element as HTMLSelectElement).validity.valueMissing)).toBe(true);
  await parent.evaluate(element => { element.closest("form")!.noValidate = true; });
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page.locator("form.staff-form").getByRole("alert")).toHaveText("Choose an Executive parent department for the new branch.");
  await expect(page).toHaveURL(/\/superadmin\/branches\/new$/);
  await expect(page.locator('input[name="name"]')).toHaveValue(name);
  await parent.selectOption(engineering);
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/branches$/);
  await expect(page.locator("main table tbody tr")).toHaveCount(branchCount + 1);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Engineering");
  await noDuplicateActions(page.locator("main table"));
  const link = row.locator('a[href^="/superadmin/branches/"]');
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page.locator('select[name="parent_department_id"]')).toHaveValue(engineering);
  await expect(page.locator('input[name="name"]')).toHaveValue(name);
  await page.goto("/superadmin/departments");
  await expect(page.locator("main table tbody tr")).toHaveCount(departmentCount);
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
});

test("staff branch lists and sidebar groups use explicit assignments without granting parent or sibling access", async ({ page }, info) => {
  await login(page, "market-editor");
  await expect(page.getByRole("region", { name: "Branches", exact: true })).toContainText("Market Affairs");
  await expect(page.getByRole("region", { name: "Your offices", exact: true })).toHaveCount(0);
  let nav = await navigation(page);
  await expect(nav.getByRole("link", { name: "Branches", exact: true })).toHaveAttribute("href", "/admin/branches");
  const ownBranches = nav.locator(".offices-nav").filter({ has: page.locator(".admin-nav-label").filter({ hasText: /^Branches$/ }) });
  await expect(ownBranches.getByRole("button", { name: "MARKET", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "TREASURY", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "SLAUGHTER", exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("assigned-branch-sidebar.png") });
  await page.goto("/admin/branches");
  await expect(page.locator("main h1")).toHaveText("Branches");
  const rows = page.locator("main table tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Market Affairs");
  await noDuplicateActions(page.locator("main table"));
  const edit = rows.getByRole("link", { name: "Edit", exact: true });
  await expect(edit).toHaveAttribute("href", editContent(market));
  await page.screenshot({ path: info.outputPath("assigned-staff-branches.png") });
  await edit.click();
  await expect(page.getByRole("button", { name: "Save record", exact: true })).toBeVisible();
  await page.locator('textarea[name="body"]').fill(`Separate section content ${info.project.name}.`);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/branches/);
  await page.goto(`/admin/content/departments?office=${market}`);
  await expect(page).toHaveURL(`/admin/branches?office=${market}`);
  await expect(page.locator("main table tbody tr")).toHaveCount(1);
  await page.goto(editContent(treasury));
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();

  await login(page, "treasury-editor");
  await expect(page.getByRole("region", { name: "Your offices", exact: true })).toContainText("Treasury");
  await expect(page.getByRole("region", { name: "Branches", exact: true })).toHaveCount(0);
  nav = await navigation(page);
  await expect(nav.getByRole("link", { name: "Branches", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "MARKET", exact: true })).toHaveCount(0);
  await expect(nav.locator(".admin-nav-label").filter({ hasText: /^Branches$/ })).toHaveCount(0);
  await page.goto(`/admin/content/departments?office=${treasury}`);
  await expect(page.locator("main table tbody tr")).toHaveCount(1);
  await expect(page.locator("main table tbody tr")).toContainText("Treasury");
  await page.goto(editContent(market));
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await page.goto("/admin/branches");
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();

  await login(page, "branch-viewer");
  await page.goto("/admin/branches");
  await expect(page.locator("main table tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  const view = page.locator("main table tbody tr").getByRole("link", { name: "View", exact: true });
  await expect(view).toHaveAttribute("href", editContent(market));
  await view.click();
  await expect(page.getByRole("button", { name: "Save record", exact: true })).toHaveCount(0);
  await expect(page.locator('textarea[name="body"]')).toBeDisabled();
  for (const id of [slaughter, waterworks]) {
    await page.goto(editContent(id));
    await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  }

  await login(page, "mixed-branch-editor");
  nav = await navigation(page);
  await expect(nav.getByRole("link", { name: "Branches", exact: true })).toHaveAttribute("href", "/admin/branches");
  await page.goto("/admin/branches");
  await expect(page.locator("main table tbody tr")).toHaveCount(1);
  await expect(page.locator("main table tbody tr")).toContainText("Market Affairs");
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save record", exact: true })).toBeVisible();
});
