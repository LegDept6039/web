import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(superadmin|admin)$/);
  await expect(page.locator("main h1")).toBeVisible();
}
const pdf = {
  name: "report.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"),
};
async function save(page: Page) {
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/transparency$/);
}
async function edit(page: Page, title: string) {
  await page.getByRole("link", { name: "Edit " + title, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/transparency\/reports\/[0-9a-f-]+$/);
  return page.url();
}
async function download(page: Page, id: string, period: string) {
  return page.request.get(`/transparency/files/${id}?period=${period}`, {
    maxRedirects: 0,
  });
}

test("dynamic modules, partial quarters, annual years, replacement, filters and safe deletion", async ({
  page,
}, info) => {
  const moduleName = "Procurement " + info.project.name,
    title = "Reusable report " + info.project.name;
  await page.route("https://fixture.supabase.test/storage/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"Key":"fixture"}',
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await login(page, "superadmin");
  await page.goto("/admin/transparency/modules");
  await page.getByRole("link", { name: "Add module", exact: true }).click();
  await page.getByLabel("Module name", { exact: true }).fill(moduleName);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Dynamically managed reports");
  await page.getByRole("button", { name: "Save module", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/transparency\/modules$/);
  await page.goto("/transparency");
  await expect(
    page.locator("summary").filter({ hasText: moduleName }),
  ).toHaveCount(0);
  await page.goto("/admin/transparency/reports/new");
  await page
    .getByRole("combobox", { name: "Module", exact: true })
    .selectOption({ label: moduleName });
  await page.getByLabel("Report Title", { exact: true }).fill(title);
  await page
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("quarterly");
  await page
    .getByRole("combobox", { name: "Year", exact: true })
    .selectOption("2026");
  await expect(page.locator('input[type="file"]')).toHaveCount(4);
  await page.getByLabel("Q1 attachment", { exact: true }).setInputFiles(pdf);
  await save(page);
  const editUrl = await edit(page, title),
    id = editUrl.split("/").pop()!;
  expect((await download(page, id, "q1")).status()).toBe(404);
  await page.getByLabel("Q2 attachment", { exact: true }).setInputFiles(pdf);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("published");
  await page.screenshot({
    path: info.outputPath("quarterly-form.png"),
    fullPage: true,
  });
  await save(page);
  const q1 = await download(page, id, "q1"),
    q2 = await download(page, id, "q2");
  expect(q1.status()).toBe(302);
  expect(q2.status()).toBe(302);
  expect((await download(page, id, "q3")).status()).toBe(404);
  expect((await download(page, id, "invalid")).status()).toBe(404);
  await page.goto(editUrl);
  await expect(
    page.getByRole("link", { name: "View current Q2", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Q1 attachment", { exact: true })
    .setInputFiles({ ...pdf, name: "replacement.pdf" });
  await save(page);
  expect((await download(page, id, "q1")).headers().location).not.toBe(
    q1.headers().location,
  );
  expect((await download(page, id, "q2")).headers().location).toBe(
    q2.headers().location,
  );
  await page.goto("/admin/transparency/reports/new");
  await page
    .getByRole("combobox", { name: "Module", exact: true })
    .selectOption({ label: moduleName });
  await page.getByLabel("Report Title", { exact: true }).fill(title);
  await page
    .getByRole("combobox", { name: "Year", exact: true })
    .selectOption("2025");
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await page
    .getByLabel("Annual PDF attachment", { exact: true })
    .setInputFiles(pdf);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("published");
  await save(page);
  await page
    .getByRole("combobox", { name: "Year", exact: true })
    .selectOption("2025");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const annualEditUrl = await edit(page, title),
    annualId = annualEditUrl.split("/").pop()!;
  expect((await download(page, annualId, "annual")).status()).toBe(302);
  await page.goto("/transparency");
  await page
    .getByRole("combobox", { name: "Module", exact: true })
    .selectOption({ label: moduleName });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(2);
  const section = page
    .locator("details.transparency-module")
    .filter({ has: page.locator("summary").filter({ hasText: moduleName }) });
  await expect(section.locator('a[href*="period=q1"]')).toHaveCount(1);
  await expect(section.locator('a[href*="period=q3"]')).toHaveCount(0);
  await section.locator("summary").click();
  await expect(section.locator("article").first()).not.toBeVisible();
  await section.locator("summary").click();
  await page.screenshot({
    path: info.outputPath("transparency-public.png"),
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Year", exact: true })
    .selectOption("2025");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(1);
  await page.getByLabel("Search reports").fill("no-matching-record");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No matching reports" }),
  ).toBeVisible();
  await page.goto("/admin/transparency/modules");
  const moduleRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: moduleName, exact: true }) });
  await expect(
    moduleRow.getByRole("cell", { name: "2", exact: true }),
  ).toHaveCount(1);
  await moduleRow.locator("summary").click();
  await moduleRow.getByLabel("Confirm deletion").check();
  await moduleRow.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(moduleRow.getByRole("alert")).toContainText("Move or delete");
  await page.screenshot({
    path: info.outputPath("transparency-modules.png"),
    fullPage: true,
  });
  await page.goto("/admin/transparency?q=" + encodeURIComponent(title));
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(2);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await page.screenshot({
    path: info.outputPath("transparency-admin.png"),
    fullPage: true,
  });
  for (let i = 0; i < 2; i++) {
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) })
      .first();
    await row.locator("summary").click();
    await row.getByLabel("Confirm deletion").check();
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/transparency$/);
    await page.goto("/admin/transparency?q=" + encodeURIComponent(title));
  }
  expect((await download(page, id, "q1")).status()).toBe(404);
  expect((await download(page, annualId, "annual")).status()).toBe(404);
  await page.goto("/admin/transparency/modules");
  await moduleRow.locator("summary").click();
  await moduleRow.getByLabel("Confirm deletion").check();
  await moduleRow.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(moduleRow).toHaveCount(0);
  await page.goto("/admin/transparency/reports/new");
  await expect(
    page.getByRole("option", { name: moduleName, exact: true }),
  ).toHaveCount(0);
});
for (const actor of ["editor", "admin", "vmo"])
  test(actor + " cannot manage Transparency", async ({ page }) => {
    await login(page, actor);
    for (const path of [
      "/admin/transparency",
      "/admin/transparency/reports/new",
      "/admin/transparency/modules",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.locator("main h1")).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: "Transparency reports", exact: true }),
    ).toHaveCount(0);
    const status = await page.evaluate(
      async () =>
        (
          await fetch("/admin/document-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scope: "transparency",
              type: "application/pdf",
              size: 50,
            }),
          })
        ).status,
    );
    expect(status).toBe(403);
  });

test("Superadmin assigns Transparency-only staff; Editor manages modules and reports; Viewer and revocation are enforced", async ({
  page,
  browser,
}, info) => {
  const username = `transparency-${info.project.name}`;
  const name = `Transparency staff ${info.project.name}`;
  const moduleName = `Assigned module ${info.project.name}`;
  await login(page, "superadmin");
  await page.goto("/superadmin/users/new");
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TestPassword123!");
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("editor");
  await page.locator('input[name="office"][value="transparency"]').check();
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  const accountRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: username, exact: true }) });
  await expect(accountRow).toContainText("Transparency");
  await accountRow
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(page).toHaveURL(/\/superadmin\/users\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Manage account" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("transparency-assignment.png"),
    fullPage: true,
  });
  await expect(
    page.locator('input[name="office"][value="transparency"]'),
  ).toBeChecked();
  await expect(page.locator('input[name="office"]:checked')).toHaveCount(1);
  const accountUrl = page.url();
  const context = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const staff = await context.newPage();
    await staff.route("https://fixture.supabase.test/storage/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"Key":"fixture"}',
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
    );
    await login(staff, username);
    await expect(
      staff.getByRole("link", { name: "Users & access control", exact: true }),
    ).toHaveCount(0);
    await staff.goto("/admin/transparency/modules");
    await staff.getByRole("link", { name: "Add module", exact: true }).click();
    await staff.getByLabel("Module name", { exact: true }).fill(moduleName);
    await staff
      .getByLabel("Description", { exact: true })
      .fill("Staff-managed module");
    await staff
      .getByRole("button", { name: "Save module", exact: true })
      .click();
    await expect(staff).toHaveURL(/\/admin\/transparency\/modules$/);
    await staff.goto("/admin/transparency/reports/new");
    await staff
      .getByRole("combobox", { name: "Module", exact: true })
      .selectOption({ label: moduleName });
    await staff.getByLabel("Report Title", { exact: true }).fill(name);
    await staff
      .getByLabel("Annual PDF attachment", { exact: true })
      .setInputFiles(pdf);
    await save(staff);
    const editUrl = await edit(staff, name);
    const id = editUrl.split("/").pop();
    expect(
      (
        await staff.request.get(
          `/admin/transparency/files/${id}?period=annual`,
          {
            maxRedirects: 0,
            // APIRequestContext does not send Secure cookies over the HTTP fixture URL.
            headers: {
              Cookie: (await context.cookies())
                .map((c) => `${c.name}=${c.value}`)
                .join("; "),
            },
          },
        )
      ).status(),
    ).toBe(302);
    expect((await download(page, id!, "annual")).status()).toBe(404);
    await page.goto(accountUrl);
    await page
      .getByRole("combobox", { name: "Role", exact: true })
      .selectOption("viewer");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page).toHaveURL(/\/superadmin\/users$/);
    await staff.goto("/admin/transparency");
    await expect(
      staff.getByRole("heading", { name: "Reports & documents", exact: true }),
    ).toBeVisible();
    await expect(staff.getByRole("cell", { name, exact: true })).toBeVisible();
    await expect(
      staff.getByRole("link", { name: "Add document", exact: true }),
    ).toHaveCount(0);
    await expect(
      staff.getByRole("link", { name: "Edit " + name, exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await staff.request.get(
          `/admin/transparency/files/${id}?period=annual`,
          {
            maxRedirects: 0,
            // APIRequestContext does not send Secure cookies over the HTTP fixture URL.
            headers: {
              Cookie: (await context.cookies())
                .map((c) => `${c.name}=${c.value}`)
                .join("; "),
            },
          },
        )
      ).status(),
    ).toBe(302);
    await staff.goto("/admin/transparency/modules");
    await expect(
      staff.getByRole("heading", { name: "Modules", exact: true }),
    ).toBeVisible();
    await expect(
      staff.getByRole("cell", { name: moduleName, exact: true }),
    ).toBeVisible();
    await expect(
      staff.getByRole("link", { name: "Add module", exact: true }),
    ).toHaveCount(0);
    await staff.goto(editUrl);
    await expect(staff).toHaveURL(/\/admin$/);
    await expect(staff.locator("main h1")).toBeVisible();
    const status = await staff.evaluate(
      async () =>
        (
          await fetch("/admin/document-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scope: "transparency",
              type: "application/pdf",
              size: 50,
            }),
          })
        ).status,
    );
    expect(status).toBe(403);
    await page.goto(accountUrl);
    await page.locator('input[name="office"][value="transparency"]').uncheck();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page).toHaveURL(/\/superadmin\/users$/);
    await staff.goto("/admin/transparency");
    await expect(staff).toHaveURL(/\/login$/);
  } finally {
    await context.close();
  }
});
