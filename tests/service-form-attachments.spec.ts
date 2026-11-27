import { expect, test, type Page } from "@playwright/test";

const office = "10000000-0000-4000-8000-000000000005";
const otherOffice = "10000000-0000-4000-8000-000000000006";
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("service-editor");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/services\?/);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("service forms upload privately, download after publication, survive editing and support replacement/removal", async ({
  page,
  context,
}, info) => {
  const title = `Downloadable application ${info.project.name}`;
  const body =
    "Download and complete the application before visiting the service desk.";
  let href = "";
  await page.route("https://fixture.supabase.test/storage/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "{}",
    }),
  );
  await login(page);
  try {
    await page.goto(`/admin/content/services/new?office=${office}`);
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await page.getByRole("textbox", { name: "Body", exact: true }).fill(body);
    const file = page.getByLabel("Service form PDF", { exact: true });
    await file.setInputFiles({
      name: "application.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await page.locator('input[name="published"]').uncheck();
    await noOverflow(page);
    await page.screenshot({
      path: info.outputPath("service-form-editor.png"),
      fullPage: true,
    });
    await save(page);
    const row = page.getByRole("row").filter({ hasText: title });
    href = (await row
      .getByRole("link", { name: "Edit", exact: true })
      .getAttribute("href"))!;
    expect(href).toBeTruthy();
    const id = new URL(href, "http://localhost").pathname.split("/").pop()!;
    const download = `/services/files/${id}`;
    expect((await page.request.get(download)).status()).toBe(404);
    await page.goto(href);
    await expect(
      page.getByRole("link", {
        name: "View current form: application.pdf",
        exact: true,
      }),
    ).toBeVisible();
    const cookie = (await page.context().cookies())
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    const staffPreview = await page.request.get(`/admin/service-forms/${id}`, {
      headers: { Cookie: cookie },
      maxRedirects: 0,
    });
    expect(staffPreview.status()).toBe(200);
    expect(staffPreview.headers()["content-type"]).toBe("application/pdf");
    expect(staffPreview.headers()["cache-control"]).toContain("no-store");
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="sort_order"]').fill("1");
    await save(page);
    const publicPage = await context.newPage();
    await publicPage.goto(`/services/${id}`);
    await expect(
      publicPage.getByRole("link", {
        name: "Download service form: application.pdf (PDF)",
        exact: true,
      }),
    ).toBeVisible();
    await noOverflow(publicPage);
    await publicPage.screenshot({
      path: info.outputPath("service-form-public.png"),
      fullPage: true,
    });
    const response = await publicPage.request.get(download);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await publicPage.goto("/departments/mho");
    const service = publicPage.locator("details.department-service").filter({
      has: publicPage.getByRole("heading", { name: title, exact: true }),
    });
    await service.locator("summary").click();
    await expect(
      service.getByRole("link", {
        name: "Download service form: application.pdf (PDF)",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(href);
    await page
      .getByRole("textbox", { name: "Body", exact: true })
      .fill(body + " Bring your identification.");
    await save(page);
    expect((await page.request.get(download)).status()).toBe(200);
    await page.goto(href);
    await page.getByLabel("Service form PDF", { exact: true }).setInputFiles({
      name: "updated-application.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await save(page);
    expect(
      (await page.request.get(download)).headers()["content-disposition"],
    ).toContain("updated-application.pdf");
    await page.goto(href);
    await page.locator('input[name="published"]').uncheck();
    await save(page);
    expect((await page.request.get(download)).status()).toBe(404);
    await page.goto(href);
    await page
      .getByLabel("Remove current form from this service", { exact: true })
      .check();
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="sort_order"]').fill("1");
    await save(page);
    await publicPage.goto(`/services/${id}`);
    await expect(
      publicPage.getByRole("link", { name: /Download service form/ }),
    ).toHaveCount(0);
    expect((await page.request.get(download)).status()).toBe(404);
    await publicPage.close();
  } finally {
    if (href) {
      await page.goto(href);
      await page.getByText("Delete this record", { exact: true }).click();
      await page
        .getByLabel("Permanently delete this record", { exact: true })
        .check();
      await page
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
      await expect(page).toHaveURL(/\/admin\/content\/services\?/);
    }
  }
});

test("service form upload rejects invalid files, cross-office requests and foreign origins", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/admin/content/services/new?office=${office}`);
  await page.getByLabel("Service form PDF", { exact: true }).setInputFiles({
    name: "application.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("text"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose a PDF up to 10 MB" }),
  ).toContainText("Choose a PDF up to 10 MB");
  const request = {
    officeId: office,
    name: "application.pdf",
    size: pdf.length,
    type: "application/pdf",
  };
  const origin = new URL(page.url()).origin;
  const cookie = (await page.context().cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const crossOffice = await page.request.post("/admin/service-form-upload", {
    data: { ...request, officeId: otherOffice },
    headers: { Origin: origin, Cookie: cookie },
    maxRedirects: 0,
  });
  expect(crossOffice.status()).toBe(403);
  const badOrigin = await page.request.post("/admin/service-form-upload", {
    data: request,
    headers: { Origin: "https://foreign.example", Cookie: cookie },
    maxRedirects: 0,
  });
  expect(badOrigin.status()).toBe(403);
  const wrongType = await page.request.post("/admin/service-form-upload", {
    data: { ...request, type: "text/plain" },
    headers: { Origin: origin, Cookie: cookie },
    maxRedirects: 0,
  });
  expect(wrongType.status()).toBe(400);
});
