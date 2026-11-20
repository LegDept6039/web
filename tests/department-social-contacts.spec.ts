import { expect, test, type Page } from "@playwright/test";

const office = "10000000-0000-4000-8000-000000000005";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("mho@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/contacts\?/);
  await expect(page.getByRole("table")).toBeVisible();
}

async function editLink(page: Page, label: string) {
  const row = page.getByRole("row").filter({ hasText: label });
  await expect(row).toHaveCount(1);
  const href = await row
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("assigned staff manage labeled social links, with only published links visible publicly", async ({
  page,
  context,
}, info) => {
  const label = `Health Office Facebook ${info.project.name}`;
  const updatedLabel = `Health Office Community Updates ${info.project.name}`;
  const draftLabel = `Private Social Contact ${info.project.name}`;
  const url = `https://www.facebook.com/municipal-health-${info.project.name}`;
  const updatedUrl = `https://www.facebook.com/municipal-health-updates-${info.project.name}`;
  const created: string[] = [];
  const publicPage = await context.newPage();
  // The map is unrelated to department contacts; avoid external Google traffic.
  await publicPage.route("https://www.google.com/maps/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Fixture location map" }),
  );

  await login(page);
  try {
    await page.goto(`/admin/content/contacts/new?office=${office}`);
    await page.locator('select[name="type"]').selectOption("SOCIAL");
    await expect(page.locator('select[name="type"] option:checked')).toHaveText(
      "Social Link",
    );
    const labelInput = page.getByRole("textbox", {
      name: "Social Link Label",
      exact: true,
    });
    const urlInput = page.getByRole("textbox", {
      name: "Social Link URL",
      exact: true,
    });
    await expect(labelInput).toHaveAttribute("required", "");
    await expect(labelInput).toHaveAttribute("maxlength", "100");
    await expect(urlInput).toHaveAttribute("type", "url");
    await expect(urlInput).toHaveAttribute("required", "");
    await labelInput.fill(label);
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="sort_order"]').fill("1");
    // Exercise server validation as well as the browser's type=url constraint.
    await page
      .locator("form.staff-form")
      .first()
      .evaluate((form) => {
        (form as HTMLFormElement).noValidate = true;
      });
    for (const invalid of [
      "javascript:alert(1)",
      "http://example.test/social",
    ]) {
      await urlInput.fill(invalid);
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname === "/admin/content/contacts/new",
        ),
        page.getByRole("button", { name: "Save record", exact: true }).click(),
      ]);
      await expect(page.locator(".staff-error").first()).toContainText(
        /https/i,
      );
      await expect(labelInput).toHaveValue(label);
      await expect(urlInput).toHaveValue(invalid);
      await expect(page.locator('select[name="type"]')).toHaveValue("SOCIAL");
    }
    await urlInput.fill(url);
    await noOverflow(page);
    await page.screenshot({
      path: info.outputPath("department-social-form.png"),
      fullPage: true,
    });
    await save(page);
    const publishedEdit = await editLink(page, label);
    created.push(publishedEdit);

    await page.goto(`/admin/content/contacts/new?office=${office}`);
    await page.locator('select[name="type"]').selectOption("SOCIAL");
    await page
      .getByLabel("Social Link Label", { exact: true })
      .fill(draftLabel);
    await page
      .getByLabel("Social Link URL", { exact: true })
      .fill(`https://example.test/private-social-${info.project.name}`);
    await page.locator('input[name="published"]').uncheck();
    await save(page);
    created.push(await editLink(page, draftLabel));

    for (const path of ["/departments/mho", "/contact"]) {
      await publicPage.goto(path);
      const contacts =
        path === "/contact"
          ? publicPage.locator(".department-contact-card").filter({
              has: publicPage.locator('a[href="/departments/mho"]'),
            })
          : publicPage.locator(".department-contacts");
      const link = contacts.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", url);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAttribute("rel", /noreferrer/);
      await expect(contacts).not.toContainText(url);
      await expect(
        publicPage.getByText(draftLabel, { exact: true }),
      ).toHaveCount(0);
      await noOverflow(publicPage);
    }

    await page.goto(publishedEdit);
    await expect(page.locator('select[name="type"]')).toHaveValue("SOCIAL");
    await expect(
      page.getByLabel("Social Link Label", { exact: true }),
    ).toHaveValue(label);
    await expect(
      page.getByLabel("Social Link URL", { exact: true }),
    ).toHaveValue(url);
    await page
      .getByLabel("Social Link Label", { exact: true })
      .fill(updatedLabel);
    await page.getByLabel("Social Link URL", { exact: true }).fill(updatedUrl);
    await save(page);
    await page.goto(publishedEdit);
    await expect(
      page.getByLabel("Social Link Label", { exact: true }),
    ).toHaveValue(updatedLabel);

    for (const path of ["/departments/mho", "/contact"]) {
      await publicPage.goto(path);
      const contacts =
        path === "/contact"
          ? publicPage.locator(".department-contact-card").filter({
              has: publicPage.locator('a[href="/departments/mho"]'),
            })
          : publicPage.locator(".department-contacts");
      await expect(
        contacts.getByRole("link", { name: updatedLabel, exact: true }),
      ).toHaveAttribute("href", updatedUrl);
      await expect(
        contacts.getByRole("link", { name: label, exact: true }),
      ).toHaveCount(0);
      await expect(contacts).not.toContainText(updatedUrl);
      await expect(
        publicPage.getByText(draftLabel, { exact: true }),
      ).toHaveCount(0);
      await contacts.scrollIntoViewIfNeeded();
      await noOverflow(publicPage);
      await contacts.screenshot({
        path: info.outputPath(
          path === "/contact"
            ? "department-social-directory.png"
            : "department-social-detail.png",
        ),
      });
    }
  } finally {
    await publicPage.close();
    // Restore the shared fixture through the same authorized CMS path.
    for (const href of created.reverse()) {
      await page.goto(href);
      await page.getByText("Delete this record", { exact: true }).click();
      await page
        .getByLabel("Permanently delete this record", { exact: true })
        .check();
      await page
        .getByRole("button", { name: "Delete record", exact: true })
        .click();
      await expect(page).toHaveURL(/\/admin\/content\/contacts\?/);
    }
  }
});
