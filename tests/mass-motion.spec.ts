import { test, expect, type Page } from "@playwright/test";
import { parseDocumentCsv, serializeDocumentCsv } from "../lib/legislative/document-csv";

const office = "10000000-0000-4000-8000-000000000004";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("vmo");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function save(page: Page, collection: string) {
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/content/${collection}\\?`));
  await expect(page.getByRole("status").filter({ hasText: "Record saved successfully." })).toBeVisible();
}

async function exportedRecord(page: Page, kind: string, title: string) {
  const result = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, text: await response.text() };
  }, `/admin/document-transfer/export?office=${office}&type=${kind}`);
  expect(result.status).toBe(200);
  const row = parseDocumentCsv(result.text).find((row) => row.title === title);
  expect(row, `Export includes ${title}`).toBeDefined();
  return row!;
}

for (const kind of ["ordinance", "resolution"] as const) {
  const collection = kind === "ordinance" ? "ordinances" : "resolutions";
  test(`${kind} can use Mass motion without inventing an author and can return to individual authorship`, async ({ page }, info) => {
    const title = `Collective ${kind} ${info.project.name}`;
    await signIn(page);
    await page.goto(`/admin/content/${collection}/new?office=${office}`);
    const approval = page.getByLabel("Approval method", { exact: true });
    await expect(approval).toHaveValue("authored");
    await page.getByLabel("Date", { exact: true }).fill("2026-11-18");
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Document Number", { exact: true }).fill(`MM-${info.project.name}`);
    await page.getByLabel("Year", { exact: true }).fill("2026");
    await page.getByLabel("Category", { exact: true }).selectOption("motion-committee");
    await expect(page.getByRole("status", { name: "Session", exact: true })).toHaveText("Motion Session");
    await page.getByLabel("Body", { exact: true }).fill(`Complete ${kind} body adopted through Mass motion.`);

    const author = page.getByLabel("Author", { exact: true });
    const coAuthor = page.getByLabel("Co-author", { exact: true });
    await expect(author).toHaveAttribute("required", "");
    await author.selectOption("motion-member-1");
    await coAuthor.selectOption("motion-member-2");
    await approval.selectOption("mass_motion");
    await expect(author).toHaveCount(0);
    await expect(coAuthor).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${kind}-mass-motion-form.png`), fullPage: true });
    await save(page, collection);

    const created = await exportedRecord(page, kind, title);
    expect(created).toMatchObject({ approval_mode: "mass_motion", author_id: "", co_author_id: "",
      committee_id: "motion-committee", session_id: "motion-session" });
    const id = created.id;
    await page.goto(`/admin/content/${collection}/view/${id}?office=${office}`);
    await expect(page.locator("main")).toContainText(/Mass motion/i);
    await expect(page.locator("main dt").filter({ hasText: /^Author$|^Co-author$/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Edit document", exact: true }).click();
    await expect(approval).toHaveValue("mass_motion");
    await expect(author).toHaveCount(0);
    await page.getByLabel("Body", { exact: true }).fill(`Edited collective ${kind} body.`);
    await save(page, collection);

    await page.goto(`/legislative/${collection}/${id}`);
    await expect(page.locator("main")).toContainText(/Mass motion/i);
    await expect(page.locator("main")).toContainText(`Edited collective ${kind} body.`);
    await expect(page.locator("main dt").filter({ hasText: /^Author$|^Co-author$/ })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${kind}-mass-motion-public.png`), fullPage: true });
    await page.goto(`/legislative/${collection}`);
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText(/Mass motion/i);
    await expect(row).not.toContainText("Motion Member A");
    await expect(row).not.toContainText("Motion Member B");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto(`/admin/content/${collection}/edit/${id}?office=${office}`);
    await approval.selectOption("authored");
    await expect(author).toHaveAttribute("required", "");
    await expect(author).toHaveValue("");
    await expect(coAuthor).toHaveValue("");
    await page.getByRole("button", { name: "Save record", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/content/${collection}/edit/`));
    await author.selectOption("motion-member-1");
    await save(page, collection);
    expect(await exportedRecord(page, kind, title)).toMatchObject({ approval_mode: "authored", author_id: "motion-member-1", co_author_id: "" });
    await page.goto(`/legislative/${collection}/${id}`);
    await expect(page.locator("main dt").filter({ hasText: /^Author$/ })).toHaveCount(1);
    await expect(page.locator("main")).toContainText("Motion Member A");
    await expect(page.locator("main")).not.toContainText(/Mass motion/i);

    // Existing individually authored records keep their saved author/co-author.
    await page.goto(`/legislative/${collection}/motion-${kind}-authored`);
    await expect(page.locator("main")).toContainText("Motion Member A");
    await expect(page.locator("main")).toContainText("Motion Member B");
    await expect(page.locator("main")).not.toContainText(/Mass motion/i);
  });
}

test("Mass motion CSV imports preserve collective approval and reject conflicting author references", async ({ page }, info) => {
  await signIn(page);
  for (const kind of ["ordinance", "resolution"] as const) {
    const title = `CSV collective ${kind} ${info.project.name}`;
    const rejectedTitle = `CSV conflicting ${kind} ${info.project.name}`;
    const collection = kind === "ordinance" ? "ordinances" : "resolutions";
    await page.goto(`/admin/content/${collection}/new?office=${office}`);
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Import Legislative Documents", exact: true })).toBeVisible();
    await dialog.getByRole("combobox", { name: "Document Type", exact: true }).selectOption(kind);
    const file = dialog.getByLabel("CSV File", { exact: true });
    const record = { title, number: `CSV-MM-${info.project.name}`, date: "2026-11-18",
      description: "CSV document adopted through collective approval.", approval_mode: "mass_motion",
      committee_id: "motion-committee" };
    await file.setInputFiles({ name: "conflicting.csv", mimeType: "text/csv",
      buffer: Buffer.from(serializeDocumentCsv([{ ...record, title: rejectedTitle, author_id: "motion-member-1" }])) });
    await dialog.getByRole("button", { name: "Import Records", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(/Mass motion|author/i);
    await file.setInputFiles({ name: "collective.csv", mimeType: "text/csv", buffer: Buffer.from(serializeDocumentCsv([record])) });
    await dialog.getByRole("button", { name: "Import Records", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText(/1/);
    const imported = await exportedRecord(page, kind, title);
    expect(imported).toMatchObject({ approval_mode: "mass_motion", author_id: "", co_author_id: "",
      committee_id: "motion-committee", session_id: "motion-session" });
    const rejected = await page.evaluate(async (url) => (await fetch(url)).text(),
      `/admin/document-transfer/export?office=${office}&type=${kind}`);
    expect(rejected).not.toContain(rejectedTitle);
    await page.goto(`/legislative/${collection}/${imported.id}`);
    await expect(page.locator("main")).toContainText(/Mass motion/i);
    await expect(page.locator("main")).toContainText(record.description);
  }
});
