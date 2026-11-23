import { test, expect, type Page } from "@playwright/test";
const officeIds = {
  legislative: "10000000-0000-4000-8000-000000000004",
  mayor: "10000000-0000-4000-8000-000000000003",
};
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`${name}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    name === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(page.locator("#admin-navigation")).toBeAttached();
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAIAAAABc2X6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAA10lEQVR4nO3XUQ1EQQhDUQyNp5F2pa6HTSZ8vJMgAFpoy5zbp2rWOzBwGM5K54YjWlFptnS2TVLwSNJKtEyWzvOQb+nuGwZb6gUEsw45hnsKwaxDjuEwnJXODUe0otJs6XygZr0DA4fhrHRuOKIVlWZLZ9skBY8krUTLZOk8D/mW7r5hsKVeQDDrkGO4pxDMOuQYDsNZ6dxwRCsqzZbOB2rWOzBwGM5K54YjWlFptnS2TVLwSNJKtEyWzvOQb+nuGwZb6gUEsw45hnsKwaxDjuEwnJXubwh+NsdmtOodwt8AAAAASUVORK5CYII=",
  "base64",
);
test("one Legislative office assigns all features without module checkboxes", async ({
  page,
}, info) => {
  await login(page, "superadmin");
  await page.goto("/superadmin/users/new");
  await expect(page.locator('input[name^="module:"]')).toHaveCount(0);
  await expect(
    page
      .locator('select[name="office"] option')
      .filter({ hasText: "SB draft" }),
  ).toHaveCount(1);
  await page
    .getByRole("listbox", { name: "Office Access", exact: true })
    .selectOption(officeIds.legislative);
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("admin");
  await page.getByLabel("Full name", { exact: true }).fill("Pedro");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`legislative-${info.project.name}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TestPassword123!");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  await page
    .getByRole("row")
    .filter({ hasText: `legislative-${info.project.name}@example.test` })
    .getByRole("link")
    .click();
  await expect(page.locator('select[name="office"]')).toHaveValues([
    officeIds.legislative,
  ]);
  await expect(page.locator('input[name^="module:"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, `legislative-${info.project.name}`);
  await page.goto(`/admin/content?office=${officeIds.legislative}`);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Administration" });
  const toggle = nav.locator(".office-toggle");
  await expect(toggle).toHaveCount(1);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Ordinances", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Users & access control" }),
  ).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Ordinances", exact: true }),
  ).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({
    path: info.outputPath("legislative-office-menu.png"),
    fullPage: true,
  });
  await nav.getByRole("link", { name: "Ordinances", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/content/ordinances?office=${officeIds.legislative}`,
  );
  await page.goto(`/admin/content?office=${officeIds.legislative}`);

  for (const name of [
    "Officials",
    "Ordinances",
    "Resolutions",
    "Sessions",
    "Documents",
  ])
    await expect(
      page.locator("main").getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await page.goto(`/admin/content/news/new?office=${officeIds.legislative}`);
  await expect(
    page.getByRole("button", { name: "Save record", exact: true }),
  ).toBeVisible();
});
test("Executive navigation stays scoped and user cannot forge Legislative access", async ({
  page,
}, info) => {
  await login(page, "restricted");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Administration" });
  await nav.locator(".office-toggle").click();
  await expect(nav.locator(".admin-module-links a")).toHaveText([
    "Office overview",
    "Contacts",
    "News",
    "Department Page & Head",
    "Programs",
  ]);
  await expect(nav.locator(".office-section-label")).toHaveCount(0);
  const uploadStatus = await page.evaluate(async (officeId) => {
    const response = await fetch("/admin/document-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        officeId,
        collection: "documents",
        type: "application/pdf",
        size: 100,
      }),
    });
    return response.status;
  }, officeIds.legislative);
  expect(uploadStatus).toBe(403);
  await page.goto(
    `/admin/content/officials/new?office=${officeIds.legislative}`,
  );
  await expect(page.getByText("PAGE NOT FOUND", { exact: true })).toBeVisible();
  await page.goto(`/admin/content/news/new?office=${officeIds.mayor}`);
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("Valid content before tampering with collection access.");
  await page.locator("form.staff-form").evaluate((element) => {
    const form = element as HTMLFormElement;
    form.noValidate = true;
    for (const [key, value] of Object.entries({
      collection: "officials",
      name: "Forbidden",
      description: "Test",
      legislative_role: "SANGGUNIANG_BAYAN",
      content_scope: "legislative",
    })) {
      let input = form.querySelector<HTMLInputElement>(`[name="${key}"]`);
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        form.append(input);
      }
      input.value = value;
    }
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText(
    "You do not have permission",
  );
});
test("Secretary creates and uploads one official, VMO edits it, public card has no links", async ({
  page,
}, info) => {
  const name = `Test SB Member ${info.project.name}`;
  await page.route("https://fixture.supabase.test/storage/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await login(page, "secretary");
  await page.goto(
    `/admin/content/officials/new?office=${officeIds.legislative}`,
  );
  await expect(
    page.getByRole("combobox", { name: "Branch", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('input[name="id"]')).toHaveCount(0);
  await expect(page.getByLabel("Owning office")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Official role", exact: true })
    .selectOption("SANGGUNIANG_BAYAN");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Test Description");
  await page.locator('input[type="file"]').setInputFiles({
    name: "wrong.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(
    page.getByText("Choose a JPEG, PNG, or WebP image up to 10 MB.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Profile photo preview")).toBeVisible();
  await page.locator('input[name="published"]').check();
  await page.locator('input[name="sort_order"]').fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/officials(?:\?|$)/);
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "vmo");
  await page.goto(`/admin/content/officials?office=${officeIds.legislative}`);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByText(/Record ID: [0-9a-f-]{36}/)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Updated Description");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/officials(?:\?|$)/);
  await page.route("**/_next/image**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.goto("/legislative/members");
  const card = page.locator(".official-card").filter({ hasText: name });
  await expect(card).toHaveCount(1);
  await expect(card.locator(".official-description")).toHaveText(
    "Updated Description",
  );
  await expect(card).toContainText("Sangguniang Bayan");
  await expect(card.locator("a,button")).toHaveCount(0);
  await expect(card.locator("img")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("official-card.png"),
    fullPage: true,
  });
});

test("official photos reject oversized files and forged image contents", async ({
  page,
}) => {
  await login(page, "secretary");
  await page.goto(
    `/admin/content/officials/new?office=${officeIds.legislative}`,
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText("Choose a JPEG, PNG, or WebP image up to 10 MB.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Official role", exact: true })
    .selectOption("SANGGUNIANG_BAYAN");
  await page.getByLabel("Name", { exact: true }).fill("Invalid Image Test");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Should not save");
  await page.locator('input[type="file"]').setInputFiles({
    name: "forged.png",
    mimeType: "image/png",
    buffer: Buffer.from("this is not an image"),
  });
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText(
    "This image cannot be read.",
  );
});

test("homepage shows four sorted Legislative officials and updates after editing order", async ({
  page,
}, info) => {
  await login(page, "secretary");
  const prefix = `Sorted ${info.project.name}`;
  const editUrls: string[] = [];
  for (let i = 0; i < 5; i++) {
    await page.goto(
      `/admin/content/officials/new?office=${officeIds.legislative}`,
    );
    await page
      .getByRole("combobox", { name: "Official role", exact: true })
      .selectOption("SANGGUNIANG_BAYAN");
    await page.getByLabel("Name", { exact: true }).fill(`${prefix} ${i}`);
    await page
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("Public official test");
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="sort_order"]').fill(String(i + 1));
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Record saved successfully.",
    );
    await expect(
      page.getByRole("columnheader", { name: "Sort Order", exact: true }),
    ).toBeVisible();
    editUrls.push(
      (await page
        .getByRole("row")
        .filter({ hasText: `${prefix} ${i}` })
        .getByRole("link", { name: "Edit", exact: true })
        .getAttribute("href"))!,
    );
  }
  await page.goto("/");
  await expect(page.locator(".official-card h3")).toHaveText(
    [0, 1, 2, 3].map((i) => `${prefix} ${i}`),
  );
  await page.goto(editUrls[4]);
  await page.locator('input[name="sort_order"]').fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Record saved successfully.",
  );
  await page.goto("/");
  await expect(page.locator(".official-card h3")).toHaveText(
    [4, 0, 1, 2].map((i) => `${prefix} ${i}`),
  );
  await page.goto("/legislative/members");
  for (let i = 0; i < 5; i++)
    await expect(
      page.getByRole("heading", { name: `${prefix} ${i}`, exact: true }),
    ).toBeVisible();
});
