import { expect, test, type Page } from "@playwright/test";

const offices = [
  {
    id: "97000000-0000-4000-8000-000000000001",
    slug: "treasury",
    kind: "Department",
    editor: "treasury-editor",
  },
  {
    id: "97000000-0000-4000-8000-000000000003",
    slug: "market-affairs",
    kind: "Branch",
    editor: "market-editor",
  },
] as const;
const fields = ["description", "head_description", "body"] as const;

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    username === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

for (const source of ["assigned editor", "Superadmin"] as const) {
  for (const office of offices) {
    test(`${source} keeps ${office.kind.toLowerCase()} description, head biography and About body independent after save`, async ({
      page,
      context,
    }, info) => {
      const superadmin = source === "Superadmin";
      const editorPath = superadmin
        ? `/superadmin/${office.kind === "Branch" ? "branches" : "departments"}/${office.id}`
        : `/admin/content/departments/edit/${office.id}?office=${office.id}`;
      const listPath = superadmin
        ? `/superadmin/${office.kind === "Branch" ? "branches" : "departments"}`
        : `/admin/${office.kind === "Branch" ? "branches" : "content/departments"}`;
      const button = superadmin
        ? `Save ${office.kind.toLowerCase()}`
        : "Save record";
      const label = `${source} ${office.kind} ${info.project.name}`;
      const description = `${label}: overview of municipal services.`;
      const biography = `${label}: the office head's professional biography.`;
      const paragraphs = [
        `${label}: detailed mandate and responsibilities.`,
        `${label}: application steps and public assistance.`,
      ];
      const body = paragraphs.join("\n\n");
      const publicPage = await context.newPage();
      await context.route("**/_next/image**", (route) =>
        route.fulfill({
          path: "public/images/logos/seal.png",
          contentType: "image/png",
        }),
      );
      await publicPage.route("https://www.google.com/maps/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "Fixture location map",
        }),
      );
      await login(page, superadmin ? "superadmin" : office.editor);
      await page.goto(editorPath);
      const original = Object.fromEntries(
        await Promise.all(
          fields.map(async (field) => [
            field,
            await page.locator(`textarea[name="${field}"]`).inputValue(),
          ]),
        ),
      );
      const save = async () => {
        await page.getByRole("button", { name: button, exact: true }).click();
        await expect(page).toHaveURL((url) => url.pathname === listPath);
        await page.goto(editorPath);
      };
      const publicView = async () => {
        await publicPage.goto(`/departments/${office.slug}`);
        await expect(publicPage.locator(".department-description")).toHaveText(
          description,
        );
        await expect(publicPage.locator(".department-description")).toHaveCount(
          1,
        );
        await noOverflow(publicPage);
      };
      try {
        for (const [field, value] of Object.entries({
          description,
          head_description: biography,
          body,
        })) {
          await page.locator(`textarea[name="${field}"]`).fill(value);
        }
        await save();
        for (const [field, value] of Object.entries({
          description,
          head_description: biography,
          body,
        })) {
          await expect(page.locator(`textarea[name="${field}"]`)).toHaveValue(
            value,
          );
        }
        await noOverflow(page);
        await publicView();
        await expect(publicPage.locator(".department-biography")).toHaveText(
          biography,
        );
        await expect(
          publicPage.getByRole("heading", {
            name: `About the ${office.kind}`,
            exact: true,
          }),
        ).toBeVisible();
        await expect(publicPage.locator(".department-body p")).toHaveText(
          paragraphs,
        );
        await expect(publicPage.locator(".department-body")).not.toContainText(
          description,
        );
        await expect(publicPage.locator(".department-body")).not.toContainText(
          biography,
        );
        await publicPage
          .locator(".department-profile")
          .scrollIntoViewIfNeeded();
        await publicPage.screenshot({
          path: info.outputPath("independent-text-fields.png"),
          fullPage: true,
        });

        // Saving empty optional fields must not copy another field into them.
        await page.locator('textarea[name="body"]').fill("");
        await page.locator('textarea[name="head_description"]').fill("");
        await save();
        await expect(page.locator('textarea[name="description"]')).toHaveValue(
          description,
        );
        await expect(page.locator('textarea[name="body"]')).toHaveValue("");
        await expect(
          page.locator('textarea[name="head_description"]'),
        ).toHaveValue("");
        await publicView();
        await expect(
          publicPage.locator(".department-body, .department-biography"),
        ).toHaveCount(0);
        await expect(
          publicPage.getByRole("heading", {
            name: `About the ${office.kind}`,
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          publicPage.getByText(description, { exact: true }),
        ).toHaveCount(1);
        await publicPage
          .locator(".department-profile")
          .scrollIntoViewIfNeeded();
        await publicPage.screenshot({
          path: info.outputPath("empty-about-stays-absent.png"),
          fullPage: true,
        });

        // An About body can return while the independent biography stays empty.
        await page.locator('textarea[name="body"]').fill(body);
        await save();
        await expect(
          page.locator('textarea[name="head_description"]'),
        ).toHaveValue("");
        await expect(page.locator('textarea[name="body"]')).toHaveValue(body);
        await publicView();
        await expect(publicPage.locator(".department-biography")).toHaveCount(
          0,
        );
        await expect(publicPage.locator(".department-body p")).toHaveText(
          paragraphs,
        );
      } finally {
        await publicPage.close();
        await page.goto(editorPath);
        for (const field of fields)
          await page.locator(`textarea[name="${field}"]`).fill(original[field]);
        await save();
      }
    });
  }
}
