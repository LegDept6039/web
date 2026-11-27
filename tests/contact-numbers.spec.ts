import { expect, test, type Page } from "@playwright/test";

const office = "10000000-0000-4000-8000-000000000005";

async function login(page: Page, username = "mho") {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    username === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
}

async function saveContact(page: Page) {
  const position = page.locator('input[type="number"][name="sort_order"]');
  if (await position.count()) await position.fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/contacts\?/);
}

async function removeContact(page: Page, path: string) {
  await page.goto(path);
  await page.getByText("Delete this record", { exact: true }).click();
  await page
    .getByLabel("Permanently delete this record", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/content\/contacts\?/);
}

async function editPath(page: Page, label: string) {
  const path = await page
    .getByRole("row")
    .filter({ hasText: label })
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  expect(path).toBeTruthy();
  return path!;
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("department phone uses fixed +63, ten digits, numeric paste and independent type switching", async ({
  page,
  context,
}, info) => {
  await login(page);
  await page.goto(`/admin/content/contacts/new?office=${office}`);
  const type = page.getByRole("combobox", { name: "Type", exact: true });
  const value = page.getByLabel("Value", { exact: true });
  await type.selectOption("PHONE");
  await expect(page.getByText("(+63)", { exact: true })).toBeVisible();
  await expect(value).toHaveAttribute("inputmode", "numeric");
  await value.fill("abc9171234567xyz");
  await expect(value).toHaveValue("9171234567");
  await value.fill("917123456");
  expect(
    await value.evaluate((input) =>
      (input as HTMLInputElement).checkValidity(),
    ),
  ).toBe(false);
  await value.fill("+63 917 123 4567");
  await expect(value).toHaveValue("9171234567");
  await value.fill("917123456799");
  await expect(value).toHaveValue("9171234567");
  await type.selectOption("EMAIL");
  await expect(value).toHaveValue("");
  await expect(page.getByText("(+63)", { exact: true })).toHaveCount(0);
  await value.fill("office@example.test");
  await type.selectOption("PHONE");
  await expect(value).toHaveValue("");
  await value.fill("0917 123 4567");
  const label = `Numeric phone ${info.project.name}`;
  await page.getByLabel("Label (optional)", { exact: true }).fill(label);
  await page.locator('[name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("phone-input.png"),
    fullPage: true,
  });
  await saveContact(page);
  const path = await editPath(page, label);
  try {
    await page.goto(path);
    await expect(value).toHaveValue("9171234567");
    const publicPage = await context.newPage();
    await publicPage.route("https://www.google.com/maps/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "Fixture map" }),
    );
    await publicPage.goto("/departments/mho");
    await expect(
      publicPage
        .locator(".department-contacts")
        .getByRole("link", { name: "+639171234567", exact: true }),
    ).toHaveAttribute("href", "tel:+639171234567");
    await publicPage.close();
    // Forge a payload without firing React's input handlers or HTML validation.
    await value.evaluate((input) => {
      const field = input as HTMLInputElement;
      field.value = "abc9171234567";
      field.form!.noValidate = true;
    });
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.locator(".staff-error").first()).toContainText(
      /Letters are not allowed/,
    );
    await page.reload();
    await expect(value).toHaveValue("9171234567");
  } finally {
    await removeContact(page, path);
  }
});

test("department landline accepts numeric formatting and refuses forged letters on save", async ({
  page,
}, info) => {
  await login(page);
  await page.goto(`/admin/content/contacts/new?office=${office}`);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("LANDLINE");
  const value = page.getByLabel("Value", { exact: true });
  await value.fill("abc(032) 468-9319xyz");
  await expect(value).toHaveValue("0324689319");
  const label = `Numeric landline ${info.project.name}`;
  await page.getByLabel("Label (optional)", { exact: true }).fill(label);
  await saveContact(page);
  const path = await editPath(page, label);
  try {
    await page.goto(path);
    await expect(value).toHaveValue("0324689319");
    await value.evaluate((input) => {
      const field = input as HTMLInputElement;
      field.value = "0324689319abc";
      field.form!.noValidate = true;
    });
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.locator(".staff-error").first()).toContainText(
      /Letters are not allowed/,
    );
    await page.reload();
    await expect(value).toHaveValue("0324689319");
    await noOverflow(page);
  } finally {
    await removeContact(page, path);
  }
});

test("municipal telephone saves digits and rejects forged letters", async ({
  page,
}) => {
  await login(page, "superadmin");
  await page.goto("/superadmin/contact");
  const telephone = page.getByLabel("Telephone", { exact: true });
  const original = await telephone.inputValue();
  const save = page.getByRole("button", {
    name: "Save contact details",
    exact: true,
  });
  try {
    await telephone.fill("letters(032)468-9319");
    await expect(telephone).toHaveValue("0324689319");
    await save.click();
    await expect(page).toHaveURL(/\/superadmin\/contact\?saved=1$/);
    await page.reload();
    await expect(telephone).toHaveValue("0324689319");
    await telephone.evaluate((input) => {
      const field = input as HTMLInputElement;
      field.value = "0324689319abc";
      field.form!.noValidate = true;
    });
    await save.click();
    await expect(
      page.locator("form.staff-form").getByRole("alert"),
    ).toContainText(/Letters are not allowed/);
    await page.reload();
    await expect(telephone).toHaveValue("0324689319");
    await noOverflow(page);
  } finally {
    await telephone.fill(original);
    await save.click();
    await expect(page).toHaveURL(/\/superadmin\/contact\?saved=1$/);
  }
});
