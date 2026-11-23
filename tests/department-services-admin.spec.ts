import { expect, test, type Page } from "@playwright/test";

const office = "10000000-0000-4000-8000-000000000005";
const otherOffice = "10000000-0000-4000-8000-000000000006";
const otherService = "61000000-0000-4000-8000-000000000001";
const legacyService = "61000000-0000-4000-8000-000000000003";
const legacyBody =
  "Bring your identification.\nPresent your existing records.\n\nStaff will explain the next steps.";

async function login(page: Page, account: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`${account}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/services\?/);
  await expect(page.getByRole("table")).toBeVisible();
}

async function editLink(page: Page, title: string) {
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  const href = await row
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}

async function remove(page: Page, href: string) {
  await page.goto(href);
  await page.getByText("Delete this record", { exact: true }).click();
  await page
    .getByLabel("Permanently delete this record", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/content\/services\?/);
  await expect(page.getByRole("table")).toBeVisible();
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("department editors create date-free services and publish multiline bodies without exposing drafts", async ({
  page,
  context,
}, info) => {
  const title = `Health consultation service ${info.project.name}`;
  const revisedTitle = `Community health consultation ${info.project.name}`;
  const draftTitle = `Private health service ${info.project.name}`;
  const body =
    "Visit the Municipal Health Office for a consultation.\nBring your identification and existing medical records.\n\nThe office will explain the next steps for your request.";
  const revisedBody = `${body}\nFollow-up guidance is provided by the health staff.`;
  const created: string[] = [];
  const publicPage = await context.newPage();
  await login(page, "service-editor");
  try {
    await publicPage.goto(`/services/${legacyService}`);
    await expect(publicPage.locator(".service-body")).toHaveText(legacyBody);
    await expect(publicPage.locator(".service-body")).toHaveCSS(
      "white-space",
      "pre-line",
    );
    await expect(publicPage.locator(".service-body .rich-text")).toHaveCount(0);
    await page.goto(
      `/admin/content/services/edit/${legacyService}?office=${office}`,
    );
    await expect(
      page.getByRole("textbox", { name: "Body", exact: true }).locator("p"),
    ).toHaveText([
      "Bring your identification.",
      "Present your existing records.",
      "",
      "Staff will explain the next steps.",
    ]);
    await page.goto(
      `/admin/content/services/edit/${otherService}?office=${otherOffice}`,
    );
    await expect(
      page.getByText("PAGE NOT FOUND", { exact: true }),
    ).toBeVisible();
    await page.goto(`/admin/content/services/new?office=${office}`);
    const titleInput = page.getByRole("textbox", {
      name: "Title",
      exact: true,
    });
    const bodyInput = page.getByRole("textbox", { name: "Body", exact: true });
    await expect(titleInput).toHaveAttribute("required", "");
    await expect(bodyInput).toHaveAttribute("contenteditable", "true");
    await expect(bodyInput).toHaveAttribute("aria-required", "true");
    await expect(
      page.getByRole("group", { name: "Body formatting", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/\/ 30,000 characters/)).toBeVisible();
    await expect(page.locator('form input[type="date"]')).toHaveCount(0);
    for (const field of ["id", "icon", "office", "steps", "description"])
      await expect(page.locator(`form [name="${field}"]:visible`)).toHaveCount(
        0,
      );
    await expect(page.locator('select[name="office_id"]')).toHaveCount(0);
    await expect(page.locator('input[name="office_id"]')).toHaveValue(office);
    await titleInput.fill(title);
    await bodyInput.fill(body);
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="sort_order"]').fill("1");
    // The server must reject a forged owner even when the form hides this value.
    await page.locator('input[name="office_id"]').evaluate((input, value) => {
      (input as HTMLInputElement).value = value;
    }, otherOffice);
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.locator(".staff-error").first()).toContainText(
      "Choose an owning department you have permission to edit.",
    );
    await expect(titleInput).toHaveValue(title);
    await expect(bodyInput).toHaveText(body, { useInnerText: true });
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="sort_order"]').fill("1");
    await page.locator('input[name="office_id"]').evaluate((input, value) => {
      (input as HTMLInputElement).value = value;
    }, office);
    await noOverflow(page);
    await page.screenshot({
      path: info.outputPath("department-service-form.png"),
      fullPage: true,
    });
    await save(page);
    const publishedEdit = await editLink(page, title);
    created.push(publishedEdit);
    const id = new URL(publishedEdit, "http://localhost").pathname
      .split("/")
      .pop()!;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
    await expect(
      page.getByText("MENRO private service", { exact: true }),
    ).toHaveCount(0);

    await page.goto(`/admin/content/services/new?office=${office}`);
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill(draftTitle);
    await page
      .getByRole("textbox", { name: "Body", exact: true })
      .fill("This service is not ready for publication.");
    await page.locator('input[name="published"]').uncheck();
    await save(page);
    created.push(await editLink(page, draftTitle));

    await publicPage.goto("/departments/mho");
    const section = publicPage.getByRole("region", {
      name: "Department Services",
      exact: true,
    });
    const legacyCard = section.locator("details").filter({
      has: publicPage.getByRole("heading", {
        name: "Legacy consultation guidance",
        exact: true,
      }),
    });
    await legacyCard.locator("summary").click();
    await expect(legacyCard.locator(".service-body")).toHaveText(legacyBody);
    await expect(legacyCard.locator(".service-body")).toHaveCSS(
      "white-space",
      "pre-line",
    );
    const service = section.locator("details").filter({
      has: publicPage.locator("summary").filter({ hasText: title }),
    });
    await expect(service).toBeVisible();
    await service.locator("summary").click();
    await expect(service).toContainText(
      "Bring your identification and existing medical records.",
    );
    await expect(service).toContainText(
      "The office will explain the next steps for your request.",
    );
    await expect(service.locator(".service-body")).toHaveText(body, {
      useInnerText: true,
    });
    await expect(service.locator(".service-body .rich-text")).toBeVisible();
    await expect(publicPage.getByText(draftTitle, { exact: true })).toHaveCount(
      0,
    );
    await noOverflow(publicPage);
    await section.screenshot({
      path: info.outputPath("department-services-public.png"),
    });

    await publicPage.goto("/services");
    await expect(
      publicPage.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(publicPage.getByText(draftTitle, { exact: true })).toHaveCount(
      0,
    );
    await expect(
      publicPage.getByText("Unpublished department service", { exact: true }),
    ).toHaveCount(0);
    const search = publicPage.getByRole("searchbox", {
      name: "Search services",
      exact: true,
    });
    const department = publicPage.getByRole("combobox", {
      name: "Department",
      exact: true,
    });
    const publishedHeading = publicPage.getByRole("heading", {
      name: title,
      exact: true,
    });
    await expect(search).toBeVisible();
    await expect(department.locator(`option[value="${office}"]`)).toHaveText(
      "MHO draft",
    );
    await expect(
      department.locator(`option[value="${otherOffice}"]`),
    ).toHaveText("MENRO draft");
    await expect(
      department.getByRole("option", { name: "MPDC draft", exact: true }),
    ).toHaveCount(0);
    await search.fill(title.toUpperCase());
    await expect(publishedHeading).toBeVisible();
    await department.selectOption(office);
    await expect(publishedHeading).toBeVisible();
    await department.selectOption(otherOffice);
    await expect(publishedHeading).toHaveCount(0);
    await expect(
      publicPage.getByRole("heading", { name: "No matching results", exact: true }),
    ).toBeVisible();
    await publicPage
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(search).toHaveValue("");
    await expect(department).toHaveValue("");
    await expect(publishedHeading).toBeVisible();
    await search.fill("service-with-no-matching-title");
    await expect(publishedHeading).toHaveCount(0);
    await expect(
      publicPage.getByRole("heading", { name: "No matching results", exact: true }),
    ).toBeVisible();
    await publicPage
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(publishedHeading).toBeVisible();
    await expect(publicPage.getByText(draftTitle, { exact: true })).toHaveCount(
      0,
    );
    await expect(
      publicPage.getByText("MENRO private service", { exact: true }),
    ).toHaveCount(0);
    await noOverflow(publicPage);
    await publicPage.locator("main").screenshot({
      path: info.outputPath("service-directory-public.png"),
    });
    await publicPage
      .locator("article")
      .filter({ has: publishedHeading })
      .locator(`a[href="/services/${id}"]`)
      .click();
    await expect(publicPage).toHaveURL(`/services/${id}`);
    await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText(
      title,
    );
    await expect(publicPage.locator("main")).toContainText(
      "The office will explain the next steps for your request.",
    );
    await expect(publicPage.locator(".service-body .rich-text")).toBeVisible();
    await noOverflow(publicPage);

    await page.goto(publishedEdit);
    await expect(
      page.getByRole("textbox", { name: "Body", exact: true }),
    ).toHaveText(body, { useInnerText: true });
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill(revisedTitle);
    await page
      .getByRole("textbox", { name: "Body", exact: true })
      .fill(revisedBody);
    await save(page);
    expect(await editLink(page, revisedTitle)).toBe(publishedEdit);
    await publicPage.goto(`/services/${id}`);
    await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText(
      revisedTitle,
    );
    await expect(publicPage.locator("main")).toContainText(
      "Follow-up guidance is provided by the health staff.",
    );
    await publicPage.goto("/departments/menro");
    await expect(
      publicPage.getByText(revisedTitle, { exact: true }),
    ).toHaveCount(0);

    await page.goto(publishedEdit);
    await page.locator('input[name="published"]').uncheck();
    await save(page);
    await publicPage.goto(`/services/${id}`);
    await expect(
      publicPage.getByText("PAGE NOT FOUND", { exact: true }),
    ).toBeVisible();
    await publicPage.goto("/departments/mho");
    await expect(
      publicPage.getByText(revisedTitle, { exact: true }),
    ).toHaveCount(0);
  } finally {
    await publicPage.close();
    for (const href of created.reverse()) await remove(page, href);
  }
});

test("department admins manage services while assigned viewers have read-only access", async ({
  page,
}, info) => {
  const title = `Admin service ${info.project.name}`;
  let href: string | undefined;
  await login(page, "mho");
  try {
    await page.goto(`/admin/content?office=${office}`);
    await expect(
      page
        .locator("main")
        .getByRole("heading", { name: "Services", exact: true }),
    ).toBeVisible();
    await page.goto(`/admin/content/services/new?office=${office}`);
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await page
      .getByRole("textbox", { name: "Body", exact: true })
      .fill("Staff service guidance.");
    await page.locator('input[name="published"]').uncheck();
    await save(page);
    href = await editLink(page, title);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, "service-viewer");
    await page.goto(`/admin/content/services?office=${office}`);
    await expect(page.getByRole("row").filter({ hasText: title })).toHaveCount(
      1,
    );
    await expect(
      page.getByRole("link", { name: "Add record", exact: true }),
    ).toHaveCount(0);
    await page.goto(href);
    await expect(page.getByText("View only", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Body", exact: true }),
    ).toHaveAttribute("contenteditable", "false");
    await expect(
      page.getByRole("button", { name: "Bold", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save record", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Delete this record", { exact: true }),
    ).toHaveCount(0);
    await page.goto(`/admin/content/services/new?office=${office}`);
    await expect(
      page.getByText("PAGE NOT FOUND", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, "mho");
    if (href) await remove(page, href);
  }
});

test("formatted service bodies retain emphasis and numbered steps in the editor and public pages", async ({
  page,
  context,
}, info) => {
  const title = `Formatted service guidance ${info.project.name}`;
  const firstStep = "Bring valid identification.";
  const secondStep = "Submit the completed application.";
  let href: string | undefined;
  const publicPage = await context.newPage();
  await login(page, "service-editor");
  try {
    await page.goto(`/admin/content/services/new?office=${office}`);
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    const editor = page.getByRole("textbox", { name: "Body", exact: true });
    await editor.fill(firstStep);
    if (info.project.name === "mobile") {
      await editor.evaluate((element) => {
        const selection = window.getSelection()!;
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      });
    } else await editor.press("ControlOrMeta+a");
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe(firstStep);
    for (const name of ["Bold", "Italic", "Numbered list"])
      await page.getByRole("button", { name, exact: true }).click();
    await expect(editor.locator("ol li strong em")).toHaveText(firstStep);
    await editor.press("ArrowRight");
    await editor.press("Enter");
    await editor.pressSequentially(secondStep);
    await expect(editor.locator("ol li")).toHaveText([firstStep, secondStep]);
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="sort_order"]').fill("1");
    await noOverflow(page);
    await page.locator(".rich-editor").screenshot({
      path: info.outputPath("service-rich-editor.png"),
    });
    await save(page);
    href = await editLink(page, title);
    const id = new URL(href, "http://localhost").pathname.split("/").pop()!;
    await page.goto(href);
    await expect(editor.locator("ol li")).toHaveText([firstStep, secondStep]);
    await expect(editor.locator("ol li strong em").first()).toHaveText(firstStep);

    await publicPage.goto(`/services/${id}`);
    const fullBody = publicPage.locator(".service-body .rich-text");
    await expect(fullBody.locator("ol li")).toHaveText([firstStep, secondStep]);
    await expect(fullBody.locator("ol li em strong").first()).toHaveText(firstStep);
    await expect(publicPage.locator(".rich-toolbar")).toHaveCount(0);
    await noOverflow(publicPage);
    await fullBody.screenshot({
      path: info.outputPath("service-rich-public.png"),
    });

    await publicPage.goto("/departments/mho");
    const service = publicPage
      .getByRole("region", { name: "Department Services", exact: true })
      .locator("details")
      .filter({ has: publicPage.getByRole("heading", { name: title, exact: true }) });
    await service.locator("summary").click();
    await expect(service.locator(".service-body .rich-text ol li")).toHaveText([
      firstStep,
      secondStep,
    ]);
    await expect(
      service.locator(".service-body .rich-text ol li em strong").first(),
    ).toHaveText(firstStep);
    await noOverflow(publicPage);
    await service.screenshot({
      path: info.outputPath("department-service-rich-public.png"),
    });
  } finally {
    await publicPage.close();
    if (href) await remove(page, href);
  }
});
