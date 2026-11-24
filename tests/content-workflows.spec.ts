import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
const office = "10000000-0000-4000-8000-000000000005";
async function login(page: Page, user = "mho") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(user);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(admin|superadmin)$/);
  await expect(page.locator("#admin-navigation")).toBeAttached();
}
async function fill(page: Page, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values))
    await (
      name === "content"
        ? page.getByRole("textbox", { name: "Content", exact: true })
        : page.locator(`form [name="${name}"]`)
    ).fill(value);
}
test("program create, stable edit, slug update, public detail and draft exclusion", async ({
  page,
}, info) => {
  const slug = `workflow-${info.project.name}`;
  await login(page);
  await page.goto(`/admin/content/programs/new?office=${office}`);
  await expect(page.locator('input[name="id"]')).toHaveCount(0);
  await fill(page, {
    slug,
    name: `Workflow program ${info.project.name}`,
    description: "Program description",
    category: "Services",
    status: "Active",
  });
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Program description");
  await page.locator('form [name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  const row = page
    .getByRole("row")
    .filter({ hasText: `Workflow program ${info.project.name}` });
  const edit = await row
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  expect(edit).toMatch(/edit\/[0-9a-f-]{36}/);
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.locator('form [name="description"]')).toHaveValue(
    "Program description",
  );
  await fill(page, {
    slug: `${slug}-renamed`,
    description: "Updated program details",
  });
  await page
    .getByRole("textbox", { name: "Body", exact: true })
    .fill("Updated program details");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page.goto(edit!);
  await expect(page.locator('form [name="description"]')).toHaveValue(
    "Updated program details",
  );
  await page.goto(`/programs/${slug}-renamed`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Workflow program ${info.project.name}`,
  );
  await expect(
    page.getByText("Updated program details", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("program-detail.png"),
    fullPage: true,
  });
  await page.goto(edit!);
  await page.locator('form [name="published"]').uncheck();
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page.goto(`/programs/${slug}-renamed`);
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await page.goto("/programs/missing-program");
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
});
test("news image create, edit by UUID after slug changes and immutable replacement", async ({
  page,
}, info) => {
  const slug = `image-news-${info.project.name}`;
  const png = await sharp("public/images/logos/seal.png")
    .resize(40, 40)
    .png()
    .toBuffer();
  await page.route("https://fixture.supabase.test/storage/**", (r) =>
    r.request().method() === "PUT"
      ? r.fulfill({
          json: { Key: "fixture-upload" },
          headers: { "Access-Control-Allow-Origin": "*" },
        })
      : r.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("**/_next/image**", (r) =>
    r.fulfill({ contentType: "image/png", body: png }),
  );
  await login(page);
  await page.goto(`/admin/content/news/new?office=${office}`);
  await expect(page.locator('form [name="category"]')).toHaveCount(0);
  await fill(page, {
    slug,
    title: `Image news ${info.project.name}`,
    date: "2026-10-08",
    excerpt: "News excerpt",
    content: "First story",
  });
  await page.locator('form [name="news_image"]').setInputFiles({
    name: "bad.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("gif"),
  });
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "JPG or PNG",
  );
  await page.locator('form [name="news_image"]').setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.locator("main").getByRole("alert")).toContainText("10 MB");
  const padded = Buffer.concat([
    png,
    Buffer.alloc(10 * 1024 * 1024 - png.length),
  ]);
  await page.locator('form [name="news_image"]').setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: padded,
  });
  await expect(page.getByAltText("News image preview")).toBeVisible();
  await page.locator('form [name="published"]').check();
  await page
    .locator("form.staff-form")
    .evaluate((el) => ((el as HTMLFormElement).noValidate = true));
  await page.locator('form [name="sort_order"]').fill("2147483648");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText("sort position");
  await fill(page, {
    slug,
    title: `Image news ${info.project.name}`,
    date: "2026-10-08",
    excerpt: "News excerpt",
    content: "First story",
    sort_order: "1",
  });
  await page.locator('form [name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  const row = page
    .getByRole("row")
    .filter({ hasText: `Image news ${info.project.name}` });
  const edit = await row
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  const id = edit!.split("/edit/")[1].split("?")[0];
  await page.goto(edit!);
  const first = await page
    .getByAltText("News image preview")
    .getAttribute("src");
  expect(first).toContain(`mho_news_${slug}_${id}.png`);
  await fill(page, { slug: `${slug}-renamed`, content: "Updated story" });
  await page.locator('form [name="news_image"]').setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page.goto(edit!);
  await expect(
    page.getByRole("textbox", { name: "Content", exact: true }),
  ).toHaveText("Updated story");
  const second = await page
    .getByAltText("News image preview")
    .getAttribute("src");
  expect(second).not.toBe(first);
  expect(second).toContain(`mho_news_${slug}-renamed_${id}.png`);
  await page.goto(`/news/${slug}-renamed`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Image news ${info.project.name}`,
  );
  await expect(page.getByText("Updated story", { exact: true })).toBeVisible();
  await page.goto(
    "/admin/content/news/edit/30000000-0000-4000-8000-000000000001",
  );
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  const denied = await page.evaluate(
    async () =>
      (
        await fetch("/admin/news-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            officeId: "10000000-0000-4000-8000-000000000006",
            size: 100,
            type: "image/png",
          }),
        })
      ).status,
  );
  expect(denied).toBe(403);
});
test("Legislative news creation receives its owning department for image uploads", async ({
  page,
}, info) => {
  const png = await sharp("public/images/logos/seal.png")
    .resize(40, 40)
    .png()
    .toBuffer();
  await page.route("https://fixture.supabase.test/storage/**", (r) =>
    r.request().method() === "PUT"
      ? r.fulfill({
          json: { Key: "fixture-upload" },
          headers: { "Access-Control-Allow-Origin": "*" },
        })
      : r.fulfill({ contentType: "image/png", body: png }),
  );
  await login(page, "legislative-editor");
  await page.goto(
    "/admin/content/news/new?office=10000000-0000-4000-8000-000000000004",
  );
  const slug = `legislative-image-${info.project.name}`;
  await fill(page, {
    slug,
    title: slug,
    date: "2026-10-08",
    excerpt: "Test image",
    content: "Test story",
  });
  await page
    .locator('input[name="news_image"]')
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page
    .getByRole("row")
    .filter({ hasText: slug })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(page.getByAltText("News image preview")).toHaveAttribute(
    "src",
    new RegExp(`legislative-access_news_${slug}_`),
  );
});

test("publication status and department-page-and-head shortcut preserve editor access", async ({
  page,
}, info) => {
  await login(page, "superadmin");
  await page.goto(`/superadmin/departments/${office}`);
  await page.locator('form [name="published"]').uncheck();
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  const row = page
    .getByRole("row")
    .filter({
      has: page.getByRole("link", { name: "Edit page, head and images", exact: true }),
    })
    .filter({ hasText: "MHO" });
  await expect(row).toContainText("Unpublished");
  await page.goto("/departments/mho");
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await login(page);
  await page.goto(`/admin/content/department-page-and-head?office=${office}`);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await fill(page, {
    head_name: `Head ${info.project.name}`,
    body: "Updated department body",
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page.goto(`/admin/content/departments/edit/${office}`);
  await expect(page.locator('form [name="head_name"]')).toHaveValue(
    `Head ${info.project.name}`,
  );
  await login(page, "superadmin");
  await page.goto(`/superadmin/departments/${office}`);
  await page.locator('form [name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  await page.goto("/departments/mho");
  await expect(
    page.getByText("Updated department body", { exact: true }),
  ).toBeVisible();
});
