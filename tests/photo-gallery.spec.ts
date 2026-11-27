import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

const office = "10000000-0000-4000-8000-000000000005";

async function images(page: Page, brokenPhoto = "") {
  const png = await sharp({
    create: { width: 960, height: 540, channels: 3, background: "#c6d8df" },
  })
    .png()
    .toBuffer();
  await page.context().route("**/_next/image**", (route) => {
    const source = new URL(route.request().url()).searchParams.get("url") || "";
    return brokenPhoto && source.endsWith(brokenPhoto)
      ? route.fulfill({ status: 404, body: "Missing fixture photo" })
      : route.fulfill({ contentType: "image/png", body: png });
  });
  await page
    .context()
    .route("https://fixture.supabase.test/storage/**", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            json: { Key: "fixture-upload" },
            headers: { "Access-Control-Allow-Origin": "*" },
          })
        : route.fulfill({ contentType: "image/png", body: png }),
    );
  return png;
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("news cover, pair and full gallery preserve story text and support arrows, thumbnails and keyboard", async ({
  page,
}, info) => {
  await images(page);
  await page.goto("/news/gallery-news-cover");
  const single = page.getByRole("region", {
    name: "Gallery news cover photos",
  });
  await expect(single.getByRole("img")).toHaveAttribute(
    "alt",
    "Gallery news cover",
  );
  await expect(single.getByRole("button")).toHaveCount(0);

  await page.goto("/news/gallery-news-pair");
  const pair = page.getByRole("region", { name: "Gallery news pair photos" });
  await expect(pair.getByText("Photo 1 of 2", { exact: true })).toBeVisible();
  await pair
    .getByRole("button", { name: "Previous photo", exact: true })
    .click();
  await expect(pair.getByText("Photo 2 of 2", { exact: true })).toBeVisible();

  await page.goto("/news/gallery-news-many");
  const gallery = page.getByRole("region", {
    name: "Gallery news many photos",
  });
  await expect(
    gallery.getByRole("button", { name: /^Show photo / }),
  ).toHaveCount(7);
  await expect(
    gallery.getByRole("img", {
      name: "Gallery news many, photo 1 of 7",
      exact: true,
    }),
  ).toBeVisible();
  await gallery
    .getByRole("button", { name: "Next photo", exact: true })
    .click();
  await expect(
    gallery.getByText("Photo 2 of 7", { exact: true }),
  ).toBeVisible();
  const last = gallery.getByRole("button", {
    name: "Show photo 7 of 7",
    exact: true,
  });
  await last.click();
  await expect(last).toHaveAttribute("aria-current", "true");
  await last.press("Home");
  const first = gallery.getByRole("button", {
    name: "Show photo 1 of 7",
    exact: true,
  });
  await expect(first).toBeFocused();
  await expect(
    gallery.getByText("Photo 1 of 7", { exact: true }),
  ).toBeVisible();
  await first.press("ArrowRight");
  await expect(
    gallery.getByRole("button", { name: "Show photo 2 of 7", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(last).toBeFocused();
  await gallery
    .getByRole("button", { name: "Next photo", exact: true })
    .click();
  await expect(
    gallery.getByText("Photo 1 of 7", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The full news story remains readable below its photographs.",
      { exact: true },
    ),
  ).toBeVisible();
  await noOverflow(page);
  await gallery
    .getByRole("img")
    .evaluate((element) => (element as HTMLImageElement).decode());
  await gallery.screenshot({ path: info.outputPath("news-gallery.png") });
});

test("programs support no photo, one photo and six selectable photos", async ({
  page,
}, info) => {
  await images(page);
  await page.goto("/programs/gallery-program-none");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Gallery program none",
  );
  await expect(
    page.getByRole("region", { name: "Gallery program none photos" }),
  ).toHaveCount(0);
  await page.goto("/programs/gallery-program-cover");
  const single = page.getByRole("region", {
    name: "Gallery program cover photos",
  });
  await expect(single.getByRole("img")).toBeVisible();
  await expect(single.getByRole("button")).toHaveCount(0);
  await page.goto("/programs/gallery-program-many");
  const gallery = page.getByRole("region", {
    name: "Gallery program many photos",
  });
  await expect(
    gallery.getByRole("button", { name: /^Show photo / }),
  ).toHaveCount(6);
  await gallery
    .getByRole("button", { name: "Show photo 4 of 6", exact: true })
    .click();
  await expect(
    gallery.getByText("Photo 4 of 6", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The complete program information remains readable below its photographs.",
      { exact: true },
    ),
  ).toBeVisible();
  await noOverflow(page);
  await gallery
    .getByRole("img")
    .evaluate((element) => (element as HTMLImageElement).decode());
  await gallery.screenshot({ path: info.outputPath("program-gallery.png") });
});

test("unavailable photos keep gallery controls usable and draft galleries remain private", async ({
  page,
}) => {
  await images(page, "gallery-2.png");
  await page.goto("/news/gallery-news-many");
  const gallery = page.getByRole("region", {
    name: "Gallery news many photos",
  });
  await gallery
    .getByRole("button", { name: "Show photo 3 of 7", exact: true })
    .click();
  await expect(
    gallery.getByRole("img", { name: "Photo 3 is unavailable", exact: true }),
  ).toBeVisible();
  await gallery
    .getByRole("button", { name: "Next photo", exact: true })
    .click();
  await expect(
    gallery.getByRole("img", {
      name: "Gallery news many, photo 4 of 7",
      exact: true,
    }),
  ).toBeVisible();
  await noOverflow(page);
  for (const path of [
    "/news/gallery-news-draft",
    "/programs/gallery-program-draft",
  ]) {
    await page.goto(path);
    await expect(
      page.getByText("PAGE NOT FOUND", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Private gallery/ }),
    ).toHaveCount(0);
  }
});

for (const collection of ["news", "programs"] as const) {
  test(`${collection} editor uploads, reloads and removes additional photos without losing the cover`, async ({
    page,
    context,
  }, info) => {
    const png = await images(page);
    await page.goto("/login");
    await page.getByLabel("Username", { exact: true }).fill("mho");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/content/${collection}/new?office=${office}`);
    const slug = `uploaded-gallery-${collection}-${info.project.name}`;
    const title = `Uploaded ${collection} gallery ${info.project.name}`;
    const values =
      collection === "news"
        ? {
            slug,
            title,
            date: "2026-11-27",
            excerpt: "News gallery upload test.",
          }
        : {
            slug,
            name: title,
            description: "Program gallery upload test.",
            category: "Community",
            status: "Ongoing",
          };
    for (const [field, value] of Object.entries(values))
      await page.locator(`form [name="${field}"]`).fill(value);
    await page
      .getByRole("textbox", {
        name: collection === "news" ? "Content" : "Body",
        exact: true,
      })
      .fill("Complete public details for the gallery record.");
    const extraPhotos = page.locator('input[name="gallery_images_files"]');
    await extraPhotos.setInputFiles({
      name: "invalid.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("gif"),
    });
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "JPG or PNG images up to 10 MB",
    );
    await extraPhotos.setInputFiles({
      name: "oversized.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "JPG or PNG images up to 10 MB",
    );
    await extraPhotos.setInputFiles(
      Array.from({ length: 13 }, (_, index) => ({
        name: `limit-${index}.png`,
        mimeType: "image/png",
        buffer: png,
      })),
    );
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "up to 12 additional photos",
    );
    await expect(
      page.getByRole("button", { name: /^Remove new photo / }),
    ).toHaveCount(0);
    await page
      .locator('input[name="news_image"]')
      .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
    await page.locator('input[name="gallery_images_files"]').setInputFiles([
      { name: "first.png", mimeType: "image/png", buffer: png },
      { name: "second.png", mimeType: "image/png", buffer: png },
    ]);
    await expect(
      page.getByRole("button", { name: /^Remove new photo / }),
    ).toHaveCount(2);
    await page.locator('form [name="published"]').check();
    await page.locator('input[name="sort_order"]').fill("1");
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Record saved successfully.",
    );
    const row = page.getByRole("row").filter({ hasText: title });
    const edit = await row
      .getByRole("link", { name: "Edit", exact: true })
      .getAttribute("href");
    expect(edit).toMatch(/edit\/[0-9a-f-]{36}/);
    await page.goto(edit!);
    await expect(
      page.getByRole("button", { name: /^Remove saved photo / }),
    ).toHaveCount(2);
    const publicPage = await context.newPage();
    await publicPage.goto(`/${collection}/${slug}`);
    const gallery = publicPage.getByRole("region", { name: `${title} photos` });
    await expect(
      gallery.getByText("Photo 1 of 3", { exact: true }),
    ).toBeVisible();
    await publicPage.close();
    await page
      .getByRole("button", { name: "Remove saved photo 1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Record saved successfully.",
    );
    await page.goto(edit!);
    await expect(
      page.getByRole("button", { name: /^Remove saved photo / }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Remove saved photo 1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Record saved successfully.",
    );
    await page.goto(`/${collection}/${slug}`);
    const cover = page.getByRole("region", { name: `${title} photos` });
    await expect(cover.getByRole("img")).toBeVisible();
    await expect(cover.getByRole("button")).toHaveCount(0);
    await noOverflow(page);
  });
}
