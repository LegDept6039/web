import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(superadmin|admin)$/);
}
test("new department becomes public, assignable and manageable without adding source code", async ({
  page,
}, info) => {
  const slug = `municipal-agriculture-${info.project.name}`,
    name = `Municipal Agriculture Office ${info.project.name}`,
    username = `agriculture-${info.project.name}`;
  const photo = await sharp("public/images/logos/seal.png")
    .resize(80, 80)
    .png()
    .toBuffer();
  await page.route("https://fixture.supabase.test/storage/**", (r) =>
    r.fulfill({ contentType: "image/png", body: photo }),
  );
  await page.route("**/_next/image**", (r) =>
    r.fulfill({ contentType: "image/png", body: photo }),
  );
  await login(page, "superadmin");
  await page.goto("/superadmin/departments/new");
  await page
    .getByRole("textbox", { name: "Department name", exact: true })
    .fill(name);
  await page.getByRole("textbox", { name: "Acronym", exact: true }).fill("MAO");
  await page.getByRole("textbox", { name: "Slug", exact: true }).fill(slug);
  await page
    .getByRole("textbox", { name: "Short description", exact: true })
    .fill("Agriculture support and services.");
  await page
    .getByLabel("Body / About content", { exact: true })
    .fill("Created with complete department information.");
  await page
    .getByLabel("Department Head Name", { exact: true })
    .fill("Initial Department Head");
  await page
    .getByLabel("Department Head Title", { exact: true })
    .fill("Municipal Officer");
  await page
    .getByLabel("Department Head Description", { exact: true })
    .fill("Serving the community.");
  await page.locator('input[name="published"]').check();
  await page.getByLabel("Display Order", { exact: true }).fill("2");
  await page
    .locator('input[name="photo"]')
    .setInputFiles({ name: "head.png", mimeType: "image/png", buffer: photo });
  await page.locator('input[name="department_image"]').setInputFiles({
    name: "office.png",
    mimeType: "image/png",
    buffer: photo,
  });
  const creationRequest = page.waitForRequest(
    (r) =>
      r.method() === "POST" && r.url().includes("/superadmin/departments/new"),
  );
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  const capturedCreation = await creationRequest;
  const row = page.getByRole("row").filter({ hasText: name });
  const href = await row
    .getByRole("link", { name: "Edit department", exact: true })
    .getAttribute("href");
  const id = href!.split("/").pop()!;
  await page.goto(href!);
  await page.getByLabel("Display Order", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  await expect(
    page.getByRole("columnheader", { name: "Sort Order", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".department-card h2").first()).toHaveText(name);
  expect(await page.locator(".department-card").count()).toBeLessThanOrEqual(4);
  await page.goto("/activities");
  await expect(
    page.locator("select option").filter({ hasText: name }),
  ).toHaveAttribute("value", id);
  await page.goto("/departments");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.goto(`/departments/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(
    page.getByRole("heading", { name: "Initial Department Head", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Created with complete department information.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".department-photo img")).toBeVisible();
  await expect(page.locator(".department-feature-image")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Contact Information", exact: true }),
  ).toHaveCount(0);
  await page.goto("/contact");
  await expect(page.getByRole("article", { name, exact: true })).toHaveCount(0);
  await expect(page.locator(".department-contact-card")).toHaveCount(0);
  await page.goto("/superadmin/users/new");
  await expect(
    page
      .getByRole("group", { name: "Office access", exact: true })
      .locator("label")
      .filter({ hasText: name }),
  ).toHaveCount(1);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Agriculture Editor");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TestPassword123!");
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("editor");
  await page.locator(`input[name="office"][value="${id}"]`).check();
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, username);
  // Replay the actual Superadmin creation action under the Editor's cookies.
  const headers = capturedCreation.headers();
  const forgedCreation = await page.request.post(capturedCreation.url(), {
    headers: {
      "content-type": headers["content-type"],
      "next-action": headers["next-action"],
      origin: new URL(capturedCreation.url()).origin,
      cookie: (await page.context().cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; "),
    },
    data: capturedCreation.postDataBuffer()!,
    maxRedirects: 0,
  });
  expect(forgedCreation.headers()["x-action-redirect"]).toContain("/admin");
  await page.goto("/superadmin/departments");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/content/departments/new");
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await page.goto(`/admin/content?office=${id}`);
  await expect(page.locator("main .staff-grid h2")).toHaveText([
    "Contacts",
    "News",
    "Department Page",
    "Programs",
  ]);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", {
    name: "Administration",
    exact: true,
  });
  await expect(
    nav.getByRole("button", { name: "MAO", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Users & access control", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/admin/content/departments/edit/${id}?office=${id}`);
  await page.locator('input[name="original"]').evaluate((el) => {
    (el as HTMLInputElement).value = "";
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText(
    "Create departments in Superadmin",
  );
  await page.goto(`/admin/content/departments/edit/${id}?office=${id}`);
  for (const field of [
    "name",
    "short_name",
    "slug",
    "active",
    "published",
    "sort_order",
  ])
    await expect(page.locator(`[name="${field}"]`)).toHaveCount(0);
  await page
    .locator("form.staff-form")
    .first()
    .evaluate((form) => {
      const input = document.createElement("input");
      input.name = "name";
      input.value = "Forged identity";
      form.appendChild(input);
    });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText(
    "identity and publication settings",
  );
  await page.goto(`/admin/content/departments/edit/${id}?office=${id}`);
  await page
    .locator('textarea[name="body"]')
    .fill("Working with local farmers.");
  await page.locator('input[name="head_name"]').fill("Agriculture Head");
  await page.locator('input[name="head_title"]').fill("Department Officer");
  await page
    .locator('input[name="photo"]')
    .setInputFiles({ name: "head.png", mimeType: "image/png", buffer: photo });
  await page.locator('input[name="department_image"]').setInputFiles({
    name: "department.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await expect(page.locator(".image-edit-overlay")).toHaveCount(2);
  await expect(page.getByAltText("Profile photo preview")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("department-editor.png"),
    fullPage: true,
  });
  await page.locator('textarea[name="body"]').fill("x".repeat(30001));
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText("too long");
  await page
    .locator('textarea[name="body"]')
    .fill("Working with local farmers.");
  await page.locator('input[name="head_name"]').fill("Agriculture Head");
  await page.locator('input[name="head_title"]').fill("Department Officer");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/departments\?/);
  const draftEmail = `draft-${info.project.name}@example.test`;
  for (const [type, value, label, published] of [
    ["PHONE", "09170000000", "Office Mobile", true],
    ["PHONE", "09280000000", "Alternate", true],
    ["EMAIL", "office@example.test", "Records", true],
    ["EMAIL", draftEmail, "Unpublished Contact", false],
  ] as const) {
    await page.goto(`/admin/content/contacts/new?office=${id}`);
    await page.locator('select[name="type"]').selectOption(type);
    await page.locator('input[name="value"]').fill(value);
    await page.locator('input[name="label"]').fill(label);
    await page.locator('input[name="published"]').setChecked(published);
    if (published) await page.locator('input[name="sort_order"]').fill("1");
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/content\/contacts\?/);
  }
  await page.goto(`/departments/${slug}`);
  await expect(
    page.getByText("Working with local farmers.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".department-description")).toHaveCSS(
    "text-align",
    "justify",
  );
  await expect(page.locator(".department-biography")).toHaveCSS(
    "text-align",
    "justify",
  );
  await expect(page.locator(".department-body p").first()).toHaveCSS(
    "text-align",
    "justify",
  );

  await expect(
    page.getByRole("heading", { name: "Agriculture Head", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "09170000000", exact: true }),
  ).toHaveAttribute("href", "tel:09170000000");
  await expect(
    page.getByRole("link", { name: "09280000000", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "office@example.test", exact: true }),
  ).toHaveAttribute("href", /mailto:/);
  await expect(
    page.getByRole("heading", { name: "Landline", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(draftEmail, { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("dynamic-department.png"),
    fullPage: true,
  });
  await page.goto("/contact");
  const directoryCard = page.getByRole("article", { name, exact: true });
  await expect(page.locator(".department-contact-card")).toHaveCount(1);
  await expect(directoryCard).toBeVisible();
  await expect(
    directoryCard.getByRole("heading", { name, level: 3, exact: true }),
  ).toBeVisible();
  await expect(
    directoryCard.getByRole("link", { name: "09170000000", exact: true }),
  ).toHaveAttribute("href", "tel:09170000000");
  await expect(
    directoryCard.getByRole("link", { name: "09280000000", exact: true }),
  ).toHaveAttribute("href", "tel:09280000000");
  await expect(
    directoryCard.getByRole("link", {
      name: "office@example.test",
      exact: true,
    }),
  ).toHaveAttribute("href", /mailto:/);
  await expect(
    directoryCard.locator(`a[href="/departments/${slug}"]`),
  ).toBeVisible();
  await expect(page.getByText(draftEmail, { exact: true })).toHaveCount(0);
  await expect(
    directoryCard.getByRole("heading", { name: "Landline", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("department-contact-directory.png"),
    fullPage: true,
  });
  await page.goto(`/admin/content/contacts?office=${id}`);
  await page.getByRole("link", { name: "Edit", exact: true }).first().click();
  await page.getByText("Delete this record", { exact: true }).click();
  await page
    .getByLabel("Permanently delete this record", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/content/contacts?office=${id}`);
  await page.goto("/admin/content/departments/edit/test-assessor");
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  for (const c of ["ordinances", "resolutions", "sessions", "hearings"]) {
    await page.goto(`/admin/content/${c}`);
    await expect(
      page.getByText("PAGE NOT FOUND", { exact: true }),
    ).toBeVisible();
  }
  await page.goto("/superadmin/users");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "superadmin");
  await page.goto(`/superadmin/departments/${id}`);
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/departments$/);
  await page.goto(`/departments/${slug}`);
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await page.goto("/contact");
  await expect(page.getByRole("article", { name, exact: true })).toHaveCount(0);
  await expect(page.locator(".department-contact-card")).toHaveCount(0);
  await page.goto("/superadmin/users/new");
  await expect(
    page
      .getByRole("group", { name: "Office access", exact: true })
      .locator("label")
      .filter({ hasText: name }),
  ).toHaveCount(0);
});
