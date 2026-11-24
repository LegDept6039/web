import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

const treasury = "97000000-0000-4000-8000-000000000001";
const engineering = "97000000-0000-4000-8000-000000000002";
const market = "97000000-0000-4000-8000-000000000003";
const slaughter = "97000000-0000-4000-8000-000000000004";
const edit = (id: string) => `/admin/content/departments/edit/${id}?office=${id}`;

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(username === "superadmin" ? /\/superadmin$/ : /\/admin$/);
  await expect(page.locator("main h1")).toBeVisible();
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
}

async function images(page: Page) {
  const photo = await sharp("public/images/logos/seal.png").resize(80, 80).png().toBuffer();
  await page.route("https://fixture.supabase.test/storage/**", r => r.fulfill({ contentType: "image/png", body: photo }));
  await page.route("**/_next/image**", r => r.fulfill({ contentType: "image/png", body: photo }));
  return photo;
}

test("Superadmin creates a published branch with its own uploaded picture and persistent parent", async ({ page }, info) => {
  const photo = await images(page);
  const name = `Treasury branch ${info.project.name}`;
  const slug = `treasury-branch-${info.project.name}`;
  await login(page, "superadmin");
  await page.goto("/superadmin/branches/new");
  await page.getByLabel("Branch name", { exact: true }).fill(name);
  await page.getByLabel("Acronym", { exact: true }).fill("TBRANCH");
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  const parent = page.locator('select[name="parent_department_id"]');
  await expect(parent.locator(`option[value="${market}"]`)).toHaveCount(0);
  await expect(parent.locator('option[value="10000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
  await parent.selectOption(treasury);
  await page.getByLabel("Short description", { exact: true }).fill("A branch created through department management.");
  await page.getByLabel("Body / About content", { exact: true }).fill("Independent branch content.");
  await page.locator('input[name="department_image"]').setInputFiles({ name: "branch.png", mimeType: "image/png", buffer: photo });
  await page.locator('input[name="published"]').check();
  await page.getByLabel("Display Order", { exact: true }).fill("1");
  await parent.evaluate(element => {
    const option = document.createElement("option");
    option.value = "10000000-0000-4000-8000-000000000004";
    option.text = "Forged Legislative parent";
    element.append(option);
  });
  await parent.selectOption("10000000-0000-4000-8000-000000000004");
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page.locator("form.staff-form").getByRole("alert")).toContainText("top-level Executive department");
  await expect(page.getByLabel("Branch name", { exact: true })).toHaveValue(name);
  await expect(page.getByLabel("Body / About content", { exact: true })).toHaveValue("Independent branch content.");
  await expect(parent).toHaveValue("10000000-0000-4000-8000-000000000004");
  expect(await page.locator('input[name="department_image"]').evaluate(element => (element as HTMLInputElement).files?.[0]?.name)).toBe("branch.png");
  await parent.selectOption(treasury);
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/branches$/);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Treasury");
  const href = await row.getByRole("link", { name: "Edit branch", exact: true }).getAttribute("href");
  await page.goto(href!);
  await expect(page.locator('select[name="parent_department_id"]')).toHaveValue(treasury);
  await expect(page.getByRole("img", { name: "Department / Branch Image preview", exact: true })).toHaveAttribute("src", /storage\/v1\/object\/public\/municipal-media\/departments/);
  await page.locator('select[name="parent_department_id"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("branch-parent-editor.png") });
  await page.goto(`/departments/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.locator(".department-parent-link a")).toHaveText("Treasury");
  await expect(page.locator(".department-branch-image img")).toHaveAttribute("src", /departments/);
  await expect(page.locator(".department-body")).toContainText("Independent branch content.");
  await page.locator(".department-branch-image").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("created-branch-picture.png") });
  await page.goto("/departments/treasury");
  await expect(page.locator(".department-branch-grid").getByRole("link", { name, exact: true })).toBeVisible();
  await page.goto(href!);
  await page.locator('input[name="published"]').uncheck();
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/branches$/);
});

test("parent and branch memberships remain separate while the assigned branch editor can update content and picture", async ({ page }, info) => {
  const photo = await images(page);
  await login(page, "treasury-editor");
  await page.goto(edit(treasury));
  await expect(page.getByRole("button", { name: "Save record", exact: true })).toBeVisible();
  for (const id of [market, slaughter, engineering]) {
    await page.goto(edit(id));
    await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  }
  await clearSession(page);
  await login(page, "market-editor");
  for (const id of [treasury, slaughter]) {
    await page.goto(edit(id));
    await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  }
  await page.goto(edit(market));
  await expect(page.getByRole("heading", { name: "Branch image", exact: true })).toBeVisible();
  await expect(page.locator('select[name="parent_department_id"]')).toHaveCount(0);
  await page.locator('textarea[name="body"]').fill(`Branch editor content ${info.project.name}.`);
  await page.locator('input[name="department_image"]').setInputFiles({ name: "market.png", mimeType: "image/png", buffer: photo });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/branches\?/);
  await page.goto(edit(market));
  await expect(page.locator('textarea[name="body"]')).toHaveValue(`Branch editor content ${info.project.name}.`);
  await expect(page.getByRole("img", { name: "Branch image preview", exact: true })).toHaveAttribute("src", /municipal-media\/departments/);
  await page.locator('form input[name="original"]').evaluate((element, value) => {
    const input = document.createElement("input");
    input.type = "hidden"; input.name = "parent_department_id"; input.value = value;
    element.closest("form")!.append(input);
  }, engineering);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText("identity and publication settings");
  await page.goto("/departments/market-affairs");
  await expect(page.locator(".department-parent-link a")).toHaveText("Treasury");
  await expect(page.locator(".department-body")).toContainText(`Branch editor content ${info.project.name}.`);
  await clearSession(page);
  await login(page, "branch-viewer");
  await page.goto(edit(market));
  await expect(page.getByRole("button", { name: "Save record", exact: true })).toHaveCount(0);
  await expect(page.locator('input[name="department_image"]')).toHaveCount(0);
  await expect(page.locator('textarea[name="body"]')).toBeDisabled();
});

test("hiding a parent hides public child pages without unpublishing or reassigning its branch", async ({ page }, info) => {
  await images(page);
  await login(page, "superadmin");
  try {
    await page.goto(`/superadmin/departments/${treasury}`);
    await page.locator('input[name="published"]').uncheck();
    await page.getByRole("button", { name: "Save department", exact: true }).click();
    await expect(page).toHaveURL(/\/superadmin\/departments$/);
    for (const slug of ["treasury", "market-affairs", "slaughter-house"]) {
      await page.goto(`/departments/${slug}`);
      await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
    }
    await page.goto("/departments/waterworks");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waterworks");
    await page.goto("/departments");
    await expect(page.locator(".department-card").getByRole("heading", { name: "Market Affairs", exact: true })).toHaveCount(0);
    await expect(page.locator(".department-card").getByRole("heading", { name: "Waterworks", exact: true })).toBeVisible();
    await page.goto(`/superadmin/branches/${market}`);
    await expect(page.locator('input[name="published"]')).toBeChecked();
    await expect(page.locator('select[name="parent_department_id"]')).toHaveValue(treasury);
    await page.locator('select[name="parent_department_id"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("hidden-parent-preserved-branch.png") });
  } finally {
    await page.goto(`/superadmin/departments/${treasury}`);
    await page.locator('input[name="published"]').check();
    await page.getByLabel("Display Order", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Save department", exact: true }).click();
    await expect(page).toHaveURL(/\/superadmin\/departments$/);
  }
  await page.goto("/departments/market-affairs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Market Affairs");
});
