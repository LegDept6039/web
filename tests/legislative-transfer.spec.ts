import { test, expect, type Page, type Download } from "@playwright/test";
import { parseDocumentCsv } from "../lib/legislative/document-csv";

const office = "10000000-0000-4000-8000-000000000004";
const headers = [
  "id",
  "title",
  "number",
  "date",
  "description",
  "author_id",
  "co_author_id",
  "committee_id",
  "session_id",
  "attachment_url",
  "approval_mode",
];
const addUrl = `/admin/content/documents/new?office=${office}&type=executive-order`;
const exportUrl = `/admin/document-transfer/export?office=${office}&type=executive-order`;

function csv(rows: Array<Record<string, string>>, columns = headers) {
  return [
    columns,
    ...rows.map((row) =>
      columns.map(
        (header) =>
          row[header] ?? (header === "description" ? "Report details." : ""),
      ),
    ),
  ]
    .map((cells) =>
      cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}

async function signIn(page: Page, account = "legislative-editor") {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(account);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("main h1")).toBeVisible();
}

async function requestExport(page: Page, url = exportUrl) {
  return page.evaluate(async (url) => {
    const response = await fetch(url);
    return {
      status: response.status,
      url: response.url,
      type: response.headers.get("content-type") || "",
      text: await response.text(),
    };
  }, url);
}

async function exportedCsv(page: Page, url = exportUrl) {
  const response = await requestExport(page, url);
  expect(response.status, response.url).toBe(200);
  expect(response.type).toContain("text/csv");
  return response.text;
}

async function openImport(page: Page) {
  await page.goto(addUrl);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  return page.getByRole("dialog", { name: "Import Legislative Documents" });
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Download did not produce a readable CSV");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

test("Legislative editor imports multiple records and exports their CSV from Add Document", async ({
  page,
}, info) => {
  const title = `Imported ${info.project.name}, \"Public Works\"`;
  const secondTitle = `Imported ${info.project.name} follow-up`;
  const description = "First paragraph.\nSecond paragraph, with a comma.";
  await signIn(page);
  const dialog = await openImport(page);
  await expect(
    dialog.getByRole("combobox", { name: "Document Type", exact: true }),
  ).toHaveValue("executive-order");
  const templateDownload = page.waitForEvent("download");
  await dialog
    .getByRole("link", { name: "Download CSV Template", exact: true })
    .click();
  const template = await downloadText(await templateDownload);
  for (const header of headers.filter((header) => header !== "approval_mode"))
    expect(template).toContain(header);
  expect(template).not.toContain("approval_mode");
  await dialog.getByLabel("CSV File", { exact: true }).setInputFiles({
    name: "executive-orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      csv([
        { title, date: "2026-11-18", description },
        {
          title: secondTitle,
          date: "2026-11-19",
          description: "Follow-up details.",
        },
      ]),
    ),
  });
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(/2/);
  await page.screenshot({
    path: info.outputPath("imported-documents.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.goto(addUrl);
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const exportDialog = page.getByRole("dialog", {
    name: "Export Legislative Documents",
  });
  const exportDownload = page.waitForEvent("download");
  await exportDialog
    .getByRole("link", { name: "Download CSV", exact: true })
    .click();
  const exported = await downloadText(await exportDownload);
  expect(exported).toContain(`"${title.replaceAll('"', '""')}"`);
  expect(exported).toContain(secondTitle);
  expect(exported).toContain(description);
  await page.goto(
    `/admin/content/documents?office=${office}&type=executive-order`,
  );
  await expect(page.getByRole("row").filter({ hasText: title })).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: secondTitle }),
  ).toBeVisible();
});

test("invalid or duplicate rows leave existing Legislative records unchanged", async ({
  page,
}, info) => {
  await signIn(page);
  const prefix = `Rejected ${info.project.name}`;
  const dialog = await openImport(page);
  const file = dialog.getByLabel("CSV File", { exact: true });
  const existing = {
    title: `Existing ${info.project.name} report`,
    date: "2026-11-19",
  };
  await file.setInputFiles({
    name: "existing-report.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv([existing])),
  });
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(/1/);
  await expect(
    dialog.getByRole("combobox", { name: "Document Type", exact: true }),
  ).toHaveValue("executive-order");
  await file.setInputFiles({
    name: "invalid-batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      csv([
        { title: `${prefix} valid first row`, date: "2026-11-18" },
        { title: `${prefix} invalid second row`, date: "2040-11-18" },
      ]),
    ),
  });
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(/term/i);
  expect(await exportedCsv(page)).not.toContain(prefix);

  const duplicate = { title: `${prefix} duplicate`, date: "2026-11-18" };
  await file.setInputFiles({
    name: "duplicate-batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv([duplicate, duplicate])),
  });
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    /duplicate|already exists|repeated/i,
  );
  expect(await exportedCsv(page)).not.toContain(prefix);

  await file.setInputFiles({
    name: "existing-record.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv([existing])),
  });
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    /duplicate|already exists/i,
  );
  await file.setInputFiles({
    name: "pagination-duplicate.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      csv([{ title: "Pagination duplicate target", date: "2026-11-17" }]),
    ),
  });
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(/already exists/i);
  await page.screenshot({
    path: info.outputPath("import-validation.png"),
    fullPage: true,
  });
});

test("viewers can export but Executive staff and forged import actions cannot write Legislative records", async ({
  page,
  browser,
}, info) => {
  await signIn(page);
  const dialog = await openImport(page);
  const title = `Permission source ${info.project.name}`;
  await dialog.getByLabel("CSV File", { exact: true }).setInputFiles({
    name: "permission-check.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv([{ title, date: "2026-11-18" }])),
  });
  type CapturedPart = {
    key: string;
    value: string | { name: string; type: string; bytes: number[] };
  };
  // Preserve the browser's actual React action encoding, including the CSV file.
  // Chromium's Request.postDataBuffer omits multipart file bodies.
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (
        init?.body instanceof FormData &&
        new Headers(init.headers).has("next-action")
      ) {
        const parts: CapturedPart[] = [];
        for (const [key, value] of init.body.entries()) {
          parts.push({
            key,
            value:
              typeof value === "string"
                ? value
                : {
                    name: value.name,
                    type: value.type,
                    bytes: Array.from(
                      new Uint8Array(await value.arrayBuffer()),
                    ),
                  },
          });
        }
        (
          window as typeof window & { transferParts: CapturedPart[] }
        ).transferParts = parts;
      }
      return original(input, init);
    };
  });
  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && Boolean(request.headers()["next-action"]),
  );
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  const request = await actionRequest;
  await expect(dialog.getByRole("status")).toContainText(/1/);
  const parts = await page.evaluate(
    () =>
      (window as typeof window & { transferParts: CapturedPart[] })
        .transferParts,
  );
  expect(parts.some((part) => typeof part.value !== "string")).toBe(true);
  const requestHeaders = request.headers();
  for (const account of ["viewer", "editor"]) {
    const context = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    const restrictedPage = await context.newPage();
    await signIn(restrictedPage, account);
    const exported = await requestExport(restrictedPage);
    expect(exported.status, `${exported.url} ${exported.type}`).toBe(
      account === "viewer" ? 200 : 403,
    );
    expect(exported.type).toContain(
      account === "viewer" ? "text/csv" : "application/json",
    );
    if (account === "viewer") {
      await restrictedPage.goto(
        `/admin/content/documents?office=${office}&type=executive-order`,
      );
      await expect(
        restrictedPage.getByRole("button", { name: "Import CSV", exact: true }),
      ).toHaveCount(0);
    }
    const forgedTitle = `Permission reject ${info.project.name} ${account}`;
    const replay = await restrictedPage.evaluate(
      async ({ url, action, parts, title, forgedTitle }) => {
        const form = new FormData();
        for (const { key, value } of parts) {
          if (typeof value === "string")
            form.append(key, value.replace(title, forgedTitle));
          else
            form.append(
              key,
              new File(
                [
                  new TextDecoder()
                    .decode(new Uint8Array(value.bytes))
                    .replace(title, forgedTitle),
                ],
                value.name,
                { type: value.type },
              ),
            );
        }
        const response = await fetch(url, {
          method: "POST",
          headers: { "next-action": action },
          body: form,
        });
        return {
          status: response.status,
          type: response.headers.get("content-type") || "",
          text: await response.text(),
        };
      },
      {
        url: request.url(),
        action: requestHeaders["next-action"],
        parts,
        title,
        forgedTitle,
      },
    );
    expect(replay.type).toContain("text/x-component");
    expect(replay.text).toMatch(/permission|not allowed|access|read-only/i);
    expect(await exportedCsv(page)).not.toContain(forgedTitle);
    await context.close();
  }
});

test("document list and Add Document support valid ordinance relationships and reject foreign records", async ({
  page,
}, info) => {
  await signIn(page);
  await page.goto(`/admin/content/documents?office=${office}`);
  await expect(
    page.getByRole("button", { name: "Import CSV", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export CSV", exact: true }),
  ).toBeVisible();
  await page
    .locator("main")
    .getByRole("link", { name: "Add Document", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add Document", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Import Legislative Documents",
  });
  const importHeaders = headers.filter((header) => header !== "session_id");
  for (const type of ["ordinance", "resolution"]) {
    await dialog
      .getByRole("combobox", { name: "Document Type", exact: true })
      .selectOption(type);
    const templateDownload = page.waitForEvent("download");
    await dialog
      .getByRole("link", { name: "Download CSV Template", exact: true })
      .click();
    const template = await downloadText(await templateDownload);
    expect(template.replace(/^\uFEFF/, "").trim()).toBe(
      importHeaders.join(","),
    );
    await expect(dialog).toContainText(
      "The date automatically links the matching session",
    );
    await expect(dialog).not.toContainText(
      "A number, author, committee and session are required",
    );
  }
  await dialog
    .getByRole("combobox", { name: "Document Type", exact: true })
    .selectOption("ordinance");
  const referencesDownload = page.waitForEvent("download");
  await dialog
    .getByRole("link", { name: "Download Reference IDs", exact: true })
    .click();
  const references = await downloadText(await referencesDownload);
  for (const id of ["term-current-a", "term-committee", "term-session"])
    expect(references).toContain(id);
  expect(references).not.toContain("transfer-executive-official");
  expect(references).not.toContain("transfer-vice-mayor");

  const valid = {
    title: `Related ordinance ${info.project.name}`,
    number: `TRANSFER-${info.project.name}`,
    date: "2026-11-16",
    author_id: "term-current-a",
    committee_id: "term-committee",
    session_id: "",
  };
  for (const author_id of [
    "term-previous-a",
    "transfer-executive-official",
    "transfer-vice-mayor",
  ]) {
    await dialog.getByLabel("CSV File", { exact: true }).setInputFiles({
      name: "invalid-relations.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        csv([
          valid,
          {
            ...valid,
            title: `Rejected relation ${author_id}`,
            number: `${valid.number}-invalid`,
            author_id,
          },
        ]),
      ),
    });
    await dialog
      .getByRole("button", { name: "Import Records", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      /related records.*office and term|Sangguniang Bayan members/i,
    );
    expect(
      await exportedCsv(
        page,
        `/admin/document-transfer/export?office=${office}&type=ordinance`,
      ),
    ).not.toContain(valid.title);
  }
  await dialog.getByLabel("CSV File", { exact: true }).setInputFiles({
    name: "valid-ordinance.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv([valid], importHeaders)),
  });
  await dialog
    .getByRole("button", { name: "Import Records", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(/1/);
  const imported = parseDocumentCsv(
    await exportedCsv(
      page,
      `/admin/document-transfer/export?office=${office}&type=ordinance`,
    ),
  ).find((record) => record.title === valid.title);
  expect(imported).toMatchObject({
    author_id: valid.author_id,
    committee_id: valid.committee_id,
    session_id: "term-session",
  });
  await page.goto(`/admin/content/ordinances?office=${office}`);
  await expect(
    page.getByRole("row").filter({ hasText: valid.title }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const exported = page.getByRole("dialog", {
    name: "Export Legislative Documents",
  });
  await expect(
    exported.getByRole("combobox", { name: "Document Type", exact: true }),
  ).toHaveValue("ordinance");
});
