import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
const office = "10000000-0000-4000-8000-000000000005";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("superadmin");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/superadmin$/);
}
async function ratio(page: Page) {
  for (const el of await page.locator(".department-photo").all()) {
    const b = await el.boundingBox();
    expect(b!.width / b!.height).toBeCloseTo(3 / 4, 2);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("head biography counter and both server actions reject oversized text without truncation", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/superadmin/departments/${office}`);
  const bio = page.locator('textarea[name="head_description"]');
  await expect(bio).toHaveAttribute("maxlength", "800");
  await bio.evaluate((el) => ((el as HTMLTextAreaElement).maxLength = 10000));
  await bio.fill("x".repeat(801));
  await expect(page.getByText(/801 \/ 800/)).toBeVisible();
  await expect(bio).toHaveValue("x".repeat(801));
  await page
    .locator("form.staff-form")
    .first()
    .evaluate((el) => ((el as HTMLFormElement).noValidate = true));
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page.locator("form.staff-form [role=alert]")).toContainText(
    "800 characters",
  );
  const valid = "First paragraph.\n\n" + "b".repeat(782);
  await bio.fill(valid);
  await expect(page.getByText(/800 \/ 800/)).toBeVisible();
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page).toHaveURL(/superadmin\/departments$/);
  await page.goto(`/admin/content/departments/edit/${office}?office=${office}`);
  await expect(bio).toHaveValue(valid);
  await bio.evaluate((el) => ((el as HTMLTextAreaElement).maxLength = 10000));
  await bio.fill("y".repeat(801));
  await page
    .locator("form.staff-form")
    .first()
    .evaluate((el) => ((el as HTMLFormElement).noValidate = true));
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".staff-error")).toContainText("800 characters");
  await page.goto("/departments/mho");
  await expect(page.locator(".department-biography")).toHaveText(valid);
});
test("portrait directory and details retain 3:4 geometry at desktop tablet and mobile widths", async ({
  page,
}, info) => {
  const photo = await sharp("public/images/logos/seal.png")
    .resize(80, 80)
    .png()
    .toBuffer();
  await page.route("https://fixture.supabase.test/storage/**", (r) =>
    r.fulfill({ contentType: "image/png", body: photo }),
  );
  await login(page);
  await page.goto(`/superadmin/departments/${office}`);
  await page
    .locator('input[name="photo"]')
    .setInputFiles({ name: "head.png", mimeType: "image/png", buffer: photo });
  await page
    .locator('input[name="department_image"]')
    .setInputFiles({ name: "head.png", mimeType: "image/png", buffer: photo });
  await page
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await expect(page).toHaveURL(/superadmin\/departments$/);
  // The fixture serves Storage transport; intercept optimized images for deterministic rendering.
  await page.route("**/_next/image**", (r) =>
    r.fulfill({
      path: "public/images/logos/seal.png",
      contentType: "image/png",
    }),
  );
  await page.goto(`/superadmin/departments/${office}`);
  const head = await page
    .getByAltText("Department Head Photo preview")
    .getAttribute("src");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/departments");
    await ratio(page);
    const cards = page.locator(".department-directory-grid .department-card");
    await expect(cards).toHaveCount(2);
    const heights = await cards.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    if (width >= 768) expect(Math.abs(heights[0] - heights[1])).toBeLessThan(2);
    await expect(
      cards.filter({ hasText: "MHO" }).locator("img"),
    ).toHaveAttribute("src", new RegExp(encodeURIComponent(head!)));
    await expect(cards.filter({ hasText: "MENRO" })).toContainText(
      "OFFICIAL PROFILE",
    );
    await page.screenshot({
      path: info.outputPath(`departments-${width}.png`),
      fullPage: true,
    });
    await page.goto("/departments/mho");
    await ratio(page);
    await expect(page.locator(".department-feature-image")).toHaveCount(0);
    await expect(page.locator(".department-photo img")).toHaveCSS(
      "object-position",
      "50% 0%",
    );
    await page.screenshot({
      path: info.outputPath(`head-${width}.png`),
      fullPage: true,
    });
  }
});
