import { test, expect, type Page } from "@playwright/test";
const office = "10000000-0000-4000-8000-000000000004";
async function session(page: Page, name: string) {
  const choices = page.locator('select[name="session_id"]');
  if (await choices.count()) await choices.selectOption({ label: name });
  else
    await expect(
      page.getByRole("status", { name: "Session", exact: true }),
    ).toHaveText(name);
}
async function save(page: Page, collection: string, publish = false) {
  if (publish && collection !== "sessions") {
    await page.getByLabel("Published", { exact: true }).check();
    await page.getByLabel("Sort order", { exact: true }).fill("1");
  }
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/content/${collection}\\?`));
  await expect(
    page.getByRole("status").filter({ hasText: "Record saved successfully." }),
  ).toBeVisible();
  await expect(page.locator("main .admin-table")).toBeVisible();
}
test("Legislative relationships and all five document types use the existing CMS", async ({
  page,
}, info) => {
  const suffix = info.project.name;
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  await page.route("https://fixture.supabase.test/storage/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ Key: "fixture-upload" }),
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("vmo");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("main .legislative-summary-grid h2")).toHaveText([
    "Officials",
    "Ordinances",
    "Resolutions",
    "Sessions",
    "Documents",
  ]);
  if (suffix === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Administration" });
  await nav
    .getByRole("button", { name: "Legislative Access", exact: true })
    .click();
  await expect(nav.locator(".office-section-label")).toHaveText([
    "OFFICE OVERVIEW",
    "DOCUMENTS",
  ]);
  await expect(nav.getByRole("link")).toHaveText([
    "Dashboard",
    "Content management",
    "Dashboard",
    "Officials",
    "Committees",
    "Sessions",
    "Add Document",
    "Ordinances",
    "Resolutions",
    "Minutes",
    "Agenda",
    "Executive Orders",
    "Profile",
    "Public website",
  ]);
  await page.screenshot({
    path: info.outputPath("legislative-dashboard.png"),
    fullPage: true,
  });
  for (const n of [1, 2]) {
    await page.goto(`/admin/content/officials/new?office=${office}`);
    await expect(
      page.locator('select[name="legislative_role"] option'),
    ).toHaveText([
      "Select a role...",
      "Sangguniang Bayan Member",
      "Vice-Mayor",
    ]);
    await page
      .locator('select[name="legislative_role"]')
      .selectOption("SANGGUNIANG_BAYAN");
    await page
      .getByLabel("Name", { exact: true })
      .fill(`Member ${n} ${suffix}`);
    await page
      .getByLabel("Description", { exact: true })
      .fill("Serving the municipality.");
    await save(page, "officials", true);
  }
  await page.goto(`/admin/content/sessions/new?office=${office}`);
  await page.getByLabel("Name", { exact: true }).fill(`Session ${suffix}`);
  await page.getByLabel("Date", { exact: true }).fill("2026-11-06");
  await page.getByLabel("No. (Session Number)", { exact: true }).fill("22");
  await page
    .getByLabel("Type", { exact: true })
    .selectOption("Regular session");
  await save(page, "sessions", true);
  await page
    .getByRole("row")
    .filter({ hasText: `Session ${suffix}` })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("No. (Session Number)", { exact: true }).fill("23");
  await save(page, "sessions");
  await page.goto(`/admin/content/committees/new?office=${office}`);
  await page
    .getByRole("combobox", { name: "Master Committee", exact: true })
    .selectOption({ label: `Committee ${suffix}` });
  await page
    .getByLabel("Chairperson", { exact: true })
    .selectOption({ label: `Member 1 ${suffix}` });
  await page
    .getByLabel("Vice-Chairperson", { exact: true })
    .selectOption({ label: `Member 2 ${suffix}` });
  for (const n of [1, 2, 3, 4])
    await expect(page.getByLabel(`Member ${n}`, { exact: true })).toBeVisible();
  await save(page, "committees", true);
  await page
    .getByRole("row")
    .filter({ hasText: `Committee ${suffix}` })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await save(page, "committees");
  for (const type of [
    "ordinance",
    "resolution",
    "agenda",
    "minutes",
    "executive-order",
  ]) {
    await page.goto(`/admin/content/documents?office=${office}`);
    await page
      .locator("main")
      .getByRole("link", { name: "Add Document", exact: true })
      .click();
    await page.getByLabel("Document type", { exact: true }).selectOption(type);
    await page.getByLabel("Title", { exact: true }).fill(`${type} ${suffix}`);
    await page.getByLabel("Date", { exact: true }).fill("2026-11-06");
    if (["ordinance", "resolution"].includes(type)) {
      await page.getByLabel("Document Number", { exact: true }).fill("2026-01");
      await page
        .getByLabel("Author", { exact: true })
        .selectOption({ label: `Member 1 ${suffix}` });
      await page.getByLabel("Co-author", { exact: true }).selectOption("");
      await page.getByLabel("Year", { exact: true }).fill("2026");
      await page
        .getByLabel("Category", { exact: true })
        .selectOption({ label: `Committee ${suffix}` });
    }
    if (type !== "executive-order") await session(page, `Session ${suffix}`);
    await page
      .getByLabel("Body", { exact: true })
      .fill(`Published body for ${type}.`);
    await expect(page.locator('input[name="published"]')).toHaveCount(0);
    const attachment = page.getByLabel("PDF attachment", { exact: true });
    await attachment.setInputFiles({
      name: "wrong.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bad"),
    });
    await expect(
      page.getByText("Choose a PDF up to 10 MB.", { exact: true }),
    ).toBeVisible();
    await attachment.setInputFiles({
      name: `${type}.pdf`,
      mimeType: "application/pdf",
      buffer: pdf,
    });
    if (type === "ordinance") {
      await page.getByLabel("Year", { exact: true }).fill("2025");
      await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
      await expect(page.locator(".staff-error")).toContainText(
        "Year must match",
      );
      await page.getByLabel("Year", { exact: true }).fill("2026");
      // Native fields reset after the action returns a validation error; the PDF must survive the retry.
      await page.getByLabel("Title", { exact: true }).fill(`${type} ${suffix}`);
      await page.getByLabel("Document Number", { exact: true }).fill("2026-01");
      await page.getByLabel("Date", { exact: true }).fill("2026-11-06");
      await page
        .getByLabel("Author", { exact: true })
        .selectOption({ label: `Member 1 ${suffix}` });
      await page
        .getByLabel("Category", { exact: true })
        .selectOption({ label: `Committee ${suffix}` });
      await session(page, `Session ${suffix}`);
      await page
        .getByLabel("Body", { exact: true })
        .fill(`Published body for ${type}.`);
      await page.screenshot({
        path: info.outputPath("document-pdf-form.png"),
        fullPage: true,
      });
    }
    const collection =
      type === "ordinance"
        ? "ordinances"
        : type === "resolution"
          ? "resolutions"
          : "documents";
    await save(page, collection);
    const row = page.getByRole("row").filter({ hasText: `${type} ${suffix}` });
    await row.getByRole("link", { name: "View", exact: true }).click();
    const firstAttachment = await page
      .getByRole("link", { name: "View PDF attachment", exact: true })
      .getAttribute("href");
    expect(firstAttachment).toMatch(/\/municipal-media\/legislative\/.*\.pdf$/);
    await expect(
      page.getByText(`Published body for ${type}.`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Edit document", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "View current PDF", exact: true }),
    ).toHaveAttribute("href", firstAttachment!);
    if (type === "ordinance")
      await page.getByLabel("PDF attachment", { exact: true }).setInputFiles({
        name: "replacement.pdf",
        mimeType: "application/pdf",
        buffer: pdf,
      });
    await page
      .getByLabel("Body", { exact: true })
      .fill(`Edited body for ${type}.`);
    await save(page, collection);
    const url = await page
      .getByRole("row")
      .filter({ hasText: `${type} ${suffix}` })
      .getByRole("link", { name: "View", exact: true })
      .getAttribute("href");
    const id = url!.split("/view/")[1].split("?")[0];
    await page.goto(`/legislative/${collection}/${id}`);
    const publicAttachment = await page
      .getByRole("link", {
        name:
          collection === "documents" ? "View attachment" : "View PDF document",
        exact: true,
      })
      .getAttribute("href");
    if (type === "ordinance")
      expect(publicAttachment).not.toBe(firstAttachment);
    else expect(publicAttachment).toBe(firstAttachment);
    await expect(
      page.getByText(`Edited body for ${type}.`, { exact: true }),
    ).toBeVisible();
  }
  await page.goto(`/admin/content/documents?office=${office}`);
  await page.getByLabel("Search title").fill(`agenda ${suffix}`);
  await page.getByLabel("Sort by").selectOption("title");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText(`agenda ${suffix}`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("legislative-documents.png"),
    fullPage: true,
  });
});
