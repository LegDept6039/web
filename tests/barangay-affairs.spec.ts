import { test, expect, type Page } from "@playwright/test";

const affairs = "10000000-0000-4000-8000-000000000008";
const mpdc = "10000000-0000-4000-8000-000000000001";
const anislag = "80000000-0000-4000-8000-000000000001";
const anopog = "80000000-0000-4000-8000-000000000002";

async function login(page: Page, user: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(user);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    user === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(page.locator("#admin-navigation")).toBeAttached();
}
async function menu(page: Page) {
  const toggle = page.getByRole("button", { name: "Menu", exact: true });
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  )
    await toggle.click();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function fillNews(page: Page, slug: string, title: string) {
  for (const [name, value] of Object.entries({
    slug,
    title,
    date: "2026-11-23",
    excerpt: "A community report for residents.",
  }))
    await page.locator(`form [name="${name}"]`).fill(value);
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("The community report body.");
}

test("assigned editors save bounded body indentation and public news follows barangay information", async ({
  page,
}, info) => {
  await login(page, "barangay-editor");
  await menu(page);
  const nav = page.locator("#admin-navigation");
  const office = nav.getByRole("button", {
    name: "Barangay Affairs",
    exact: true,
  });
  await expect(office).toBeVisible();
  if ((await office.getAttribute("aria-expanded")) === "false")
    await office.click();
  await expect(
    nav.getByRole("link", { name: "Barangays", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "News", exact: true }),
  ).toHaveAttribute("href", `/admin/content/news?office=${affairs}`);
  await nav.getByRole("link", { name: "Barangays", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/barangays$/);
  await expect(
    page.getByRole("row").filter({ hasText: "Draft Community" }),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Anislag" })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  const editor = page.getByRole("textbox", { name: "Body", exact: true });
  await editor.fill(`Indented barangay information ${info.project.name}.`);
  await page
    .getByRole("button", { name: "Clear formatting", exact: true })
    .click();
  const increase = page.getByRole("button", {
    name: "Increase indent",
    exact: true,
  });
  const decrease = page.getByRole("button", {
    name: "Decrease indent",
    exact: true,
  });
  await expect(decrease).toBeDisabled();
  for (let i = 0; i < 6; i++) await increase.click();
  await expect(editor.locator('p[data-indent="6"]')).toBeVisible();
  await expect(increase).toBeDisabled();
  for (let i = 0; i < 4; i++) await decrease.click();
  await expect(editor.locator('p[data-indent="2"]')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("barangay-editor.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save barangay", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/barangays\?saved=1$/);
  await page.goto(`/admin/barangays/${anislag}`);
  await expect(editor.locator('p[data-indent="2"]')).toHaveText(
    `Indented barangay information ${info.project.name}.`,
  );
  await page.goto("/barangays/anislag");
  const body = page.locator('.barangay-body p[data-indent="2"]');
  await expect(body).toHaveText(
    `Indented barangay information ${info.project.name}.`,
  );
  expect(
    await body.evaluate((el) =>
      parseFloat(getComputedStyle(el).marginInlineStart),
    ),
  ).toBeGreaterThan(0);
  const news = page.getByRole("region", { name: "Barangay news", exact: true });
  await expect(
    news.getByRole("heading", {
      name: "Anislag community update",
      exact: true,
    }),
  ).toBeVisible();
  for (const title of [
    "Anislag unpublished news",
    "Anopog community update",
    "Ordinary department update",
    "Unpublished community news",
  ])
    await expect(
      news.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
  expect(
    await body.evaluate((el) =>
      Boolean(
        el.compareDocumentPosition(
          document.querySelector("#barangay-news-title")!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("barangay-information-news.png"),
    fullPage: true,
  });
});

test("Barangay Affairs news requires a linked barangay and appears only on that community page", async ({
  page,
}, info) => {
  await login(page, "barangay-admin");
  await page.goto(`/admin/content/news/new?office=${affairs}`);
  const select = page.getByRole("combobox", { name: "Barangay", exact: true });
  await expect(select).toBeVisible();
  await expect(select).toHaveAttribute("required", "");
  const title = `Barangay report ${info.project.name}`;
  await fillNews(page, `barangay-report-${info.project.name}`, title);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  expect(
    await select.evaluate(
      (el) => (el as HTMLSelectElement).validity.valueMissing,
    ),
  ).toBe(true);
  await select.selectOption(anopog);
  await page.locator('input[name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(select).toHaveValue(anopog);
  await page.goto("/barangays/anopog");
  await expect(
    page
      .getByRole("region", { name: "Barangay news", exact: true })
      .getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.goto("/barangays/anislag");
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
});

test("unassigned staff cannot edit barangays, enter SK management or forge barangay news ownership", async ({
  page,
}, info) => {
  await login(page, "editor");
  await expect(
    page
      .locator("#admin-navigation")
      .getByRole("button", { name: "Barangay Affairs", exact: true }),
  ).toHaveCount(0);
  for (const route of [
    "/admin/barangays",
    "/admin/barangays/new",
    `/admin/barangays/${anislag}`,
    `/admin/content/news/new?office=${affairs}`,
  ]) {
    await page.goto(route);
    await expect(
      page.getByText("PAGE NOT FOUND", { exact: true }),
    ).toBeVisible();
  }
  await page.goto("/superadmin/barangays/sk");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Test editor", exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/content/news/new?office=${mpdc}`);
  await expect(
    page.getByRole("combobox", { name: "Barangay", exact: true }),
  ).toHaveCount(0);
  await fillNews(
    page,
    `forged-barangay-${info.project.name}`,
    "Forged barangay news",
  );
  await page.locator("form.staff-form").evaluate((form, id) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "barangay_id";
    input.value = id;
    form.append(input);
  }, anislag);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText(
    "Barangay news must belong to Barangay Affairs.",
  );
  await page.goto("/barangays/anislag");
  await expect(
    page.getByRole("heading", { name: "Forged barangay news", exact: true }),
  ).toHaveCount(0);
});

test("assigned viewers can inspect unpublished profiles but cannot save or create barangays", async ({
  page,
}) => {
  await login(page, "barangay-viewer");
  await page.goto("/admin/barangays");
  await expect(
    page.getByRole("row").filter({ hasText: "Draft Community" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add barangay", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("row")
    .filter({ hasText: "Anislag" })
    .getByRole("link", { name: "View", exact: true })
    .click();
  await expect(
    page.getByLabel("Barangay name", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Body", exact: true }),
  ).toHaveAttribute("contenteditable", "false");
  await expect(
    page.getByRole("button", { name: "Increase indent", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save barangay", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/barangays/new");
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await page.goto("/superadmin/barangays/sk/new");
  await expect(page).toHaveURL(/\/admin$/);
});

test("Superadmin manages Barangay Affairs access while retaining barangay and SK administration", async ({
  page,
}, info) => {
  await login(page, "superadmin");
  await page.goto("/superadmin/users/new");
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("editor");
  const assignments = page.getByRole("group", {
    name: "Office access",
    exact: true,
  });
  const affairsAccess = assignments.locator(
    `input[name="office"][value="${affairs}"]`,
  );
  await expect(affairsAccess).toHaveAccessibleName(/Barangay Affairs/);
  await affairsAccess.check();
  await expect(affairsAccess).toBeChecked();
  await expect(assignments.locator('input[name="office"]:checked')).toHaveCount(
    1,
  );
  await page.goto("/superadmin/departments");
  const row = page.getByRole("row").filter({ hasText: "barangay-affairs" });
  await expect(row).toContainText("Staff access workspace");
  await expect(
    row.getByRole("link", { name: "Edit page, head and images", exact: true }),
  ).toHaveCount(0);
  await row
    .getByRole("link", { name: "Edit department", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Barangay Affairs", exact: true }),
  ).toBeVisible();
  for (const name of [
    "name",
    "short_name",
    "slug",
    "department",
    "published",
    "sort_order",
  ])
    await expect(page.locator(`form [name="${name}"]`)).toHaveCount(0);
  let restore = false;
  try {
    await page.locator("form.staff-form").evaluate((form) => {
      for (const [name, value] of Object.entries({
        name: "Forged workspace",
        slug: "forged-workspace",
        published: "on",
        sort_order: "1",
      })) {
        const field = document.createElement("input");
        field.type = "hidden";
        field.name = name;
        field.value = value;
        form.append(field);
      }
    });
    await page.getByLabel("Active", { exact: true }).uncheck();
    restore = true;
    await page
      .getByRole("button", { name: "Save access settings", exact: true })
      .click();
    await expect(page).toHaveURL(/\/superadmin\/departments$/);
    await expect(row).toContainText("Inactive");
    await expect(row).toContainText("Staff access workspace");
    await expect(row).toContainText("Barangay Affairs");
    await menu(page);
    const nav = page.locator("#admin-navigation");
    await expect(
      nav.getByRole("button", { name: "Barangay Affairs", exact: true }),
    ).toHaveCount(0);
    const fallback = nav.getByRole("button", {
      name: "Barangays",
      exact: true,
    });
    await expect(fallback).toBeVisible();
    if ((await fallback.getAttribute("aria-expanded")) === "false")
      await fallback.click();
    await expect(
      nav.getByRole("link", { name: "SK", exact: true }),
    ).toBeVisible();
    await nav.getByRole("link", { name: "Barangay", exact: true }).click();
    await expect(page).toHaveURL(/\/superadmin\/barangays$/);
    await expect(
      page.getByRole("row").filter({ hasText: "Anislag" }),
    ).toBeVisible();
    await page.goto("/superadmin/barangays/sk");
    await expect(
      page.getByRole("heading", { name: /Sangguniang Kabataan|SK profiles/ }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("inactive-workspace-superadmin.png"),
      fullPage: true,
    });
  } finally {
    if (restore) {
      await page.goto(`/superadmin/departments/${affairs}`);
      await page.getByLabel("Active", { exact: true }).check();
      await page
        .getByRole("button", { name: "Save access settings", exact: true })
        .click();
      await expect(page).toHaveURL(/\/superadmin\/departments$/);
      await expect(row).toContainText("Active");
    }
  }
  await menu(page);
  const nav = page.locator("#admin-navigation");
  const workspace = nav.getByRole("button", {
    name: "Barangay Affairs",
    exact: true,
  });
  await expect(workspace).toBeVisible();
  if ((await workspace.getAttribute("aria-expanded")) === "false")
    await workspace.click();
  await expect(
    nav.getByRole("link", { name: "Barangays", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: /^(Sangguniang Kabataan \(SK\)|SK)$/ }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "News", exact: true }),
  ).toHaveAttribute("href", `/admin/content/news?office=${affairs}`);
  await noOverflow(page);
});
