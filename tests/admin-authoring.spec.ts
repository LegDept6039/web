import { test, expect, type Page } from "@playwright/test";
const mho = "10000000-0000-4000-8000-000000000005";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("superadmin");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/superadmin$/);
}
test("office navigation scopes modules, expands one office and follows current route", async ({
  page,
}, info) => {
  await login(page);
  await page.goto(`/admin/content?office=${mho}`);
  await expect(page.locator("main .staff-grid h2")).toHaveText([
    "Contacts",
    "News",
    "Department Page",
    "Programs",
  ]);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Administration" });
  await expect(
    nav.getByRole("button", { name: "MHO", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(nav.locator(".admin-module-links a")).toHaveText([
    "Contacts",
    "News",
    "Department Page & Head",
    "Programs",
  ]);
  await nav
    .getByRole("button", { name: "Legislative Access", exact: true })
    .click();
  await expect(
    nav.getByRole("button", { name: "MHO", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Ordinances", exact: true }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "MHO", exact: true }).click();
  await nav.getByRole("link", { name: "News", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/content/news\\?office=${mho}`),
  );
  if (info.project.name === "mobile") {
    await expect(
      page.getByRole("button", { name: "Menu", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  }
  await expect(
    nav.getByRole("link", { name: "News", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({
    path: info.outputPath("office-navigation.png"),
    fullPage: true,
  });
  await nav.getByRole("link", { name: "Departments", exact: true }).click();
  await expect(page).toHaveURL(/superadmin\/departments$/);
});
test("formatted news validates publication, restores formatting and renders safely", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto(`/admin/content/news/new?office=${mho}`);
  await expect(page.locator('input[name="sort_order"]')).toHaveAttribute(
    "type",
    "hidden",
  );
  const slug = `formatted-${info.project.name}`;
  for (const [key, value] of Object.entries({
    slug,
    title: slug,
    date: "2026-10-10",
    excerpt: "A compact formatted article.",
  }))
    await page.locator(`form [name="${key}"]`).fill(value);
  const editor = page.getByRole("textbox", { name: "Content", exact: true });
  await editor.fill("Formatted municipal update");
  if (info.project.name === "mobile") {
    await editor.evaluate((el) => {
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
  } else await editor.press("ControlOrMeta+a");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Formatted municipal update");
  for (const name of ["Bold", "Italic", "Underline"])
    await page.getByRole("button", { name, exact: true }).click();
  await page
    .getByRole("combobox", { name: "Text size", exact: true })
    .selectOption("large");
  await expect(editor.locator('p[data-size="large"] strong em u')).toHaveText(
    "Formatted municipal update",
  );
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await expect(editor.locator("ul li")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Numbered list", exact: true })
    .click();
  await expect(editor.locator("ol li")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("ul li")).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor.locator("ol li")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Clear formatting", exact: true })
    .click();
  await expect(editor.locator("strong, em, u, ol, ul")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("ol li strong em u")).toHaveText(
    "Formatted municipal update",
  );
  await page
    .getByRole("combobox", { name: "Text size", exact: true })
    .selectOption("large");
  await page.locator('input[name="published"]').check();
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  expect(
    await page
      .locator('input[name="sort_order"]')
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
  ).toBe(true);
  await expect(page).toHaveURL(/news\/new/);
  await page.locator('input[name="sort_order"]').fill("1");
  await page.screenshot({
    path: info.outputPath("rich-editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page
    .getByRole("row")
    .filter({ hasText: slug })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(editor.locator("ol li strong em u")).toHaveText(
    "Formatted municipal update",
  );
  await page.goto(`/news/${slug}`);
  await expect(page.locator(".rich-text ol li u em strong")).toHaveText(
    "Formatted municipal update",
  );
  await expect(page.locator('.rich-text p[data-size="large"]')).toHaveText(
    "Formatted municipal update",
  );
  await expect(page.locator(".rich-toolbar")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("rich-public.png"),
    fullPage: true,
  });
  await page.goto("/departments/mho");
  await expect(
    page.locator(".news-card-compact").filter({ hasText: slug }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("compact-news.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("public article displays script-like body text literally", async ({
  page,
}, info) => {
  await login(page);
  await page.goto(`/admin/content/news/new?office=${mho}`);
  const slug = `safe-body-${info.project.name}`;
  for (const [key, value] of Object.entries({
    slug,
    title: slug,
    date: "2026-10-10",
    excerpt: "Escaped text test.",
  }))
    await page.locator(`form [name="${key}"]`).fill(value);
  const body = "<script>window.unsafeArticle=true</script>";
  await page.getByRole("textbox", { name: "Content", exact: true }).fill(body);
  await page.locator('input[name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  const edit = await page
    .getByRole("row")
    .filter({ hasText: slug })
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  await page.goto(`/news/${slug}`);
  await expect(page.locator(".rich-text")).toHaveText(body);
  await expect(page.locator(".rich-text script")).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, "unsafeArticle")),
  ).toBeUndefined();
  await page.goto(edit!);
  await page.getByText("Delete this record", { exact: true }).click();
  await page
    .getByLabel("Permanently delete this record", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/content/news\\?office=${mho}`),
  );
  await expect(page.getByRole("row").filter({ hasText: slug })).toHaveCount(0);
});
