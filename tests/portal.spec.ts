import { test, expect } from "@playwright/test";

test("homepage and responsive navigation", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Pinamungajan",
  );
  await expect(page.locator(".hero-image")).toBeVisible();
  expect(
    await page
      .locator(".hero-image")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Legislative", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Legislative", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page
    .locator("#menu-Legislative")
    .getByRole("link", { name: "Ordinances", exact: true })
    .click();
  await expect(page).toHaveURL(/\/legislative\/ordinances$/);
  if (testInfo.project.name === "mobile")
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
  await page.goto("/");
  for (const img of await page.locator("img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
      )
      .toBeTruthy();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/viewport-${testInfo.project.name}.png`,
  });
  await page.screenshot({
    path: `test-results/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("ordinances search, year filter, empty state, reset and record detail", async ({
  page,
}) => {
  await page.goto("/legislative/ordinances");
  await expect(page.locator(".document-card")).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Filter by year" })
    .selectOption("2025");
  await expect(page.locator(".document-card")).toHaveCount(1);
  await expect(page.locator(".document-card")).toContainText(
    "coastal protection",
  );
  await page.getByRole("textbox", { name: "Search ordinances" }).fill("water");
  await expect(
    page.getByRole("heading", { name: "No matching results" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await page
    .getByRole("textbox", { name: "Search ordinances" })
    .fill("01-2026");
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page.getByRole("link", { name: "View record" }).click();
  await expect(
    page.getByRole("heading", { name: "Ordinance No. 01-2026", exact: true }),
  ).toBeVisible();
  const pdf = page.getByRole("link", { name: "View sample PDF document" });
  await expect(pdf).toBeVisible();
  const response = await page.request.get((await pdf.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
});

test("resolution co-author and year searches", async ({ page }) => {
  await page.goto("/legislative/resolutions");
  await page
    .getByRole("combobox", { name: "Filter by year" })
    .selectOption("2025");
  await page
    .getByRole("textbox", { name: "Search resolutions" })
    .fill("Sample Council Member C");
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page.getByRole("link", { name: "View record" }).click();
  await expect(page.getByText("Co-author", { exact: true })).toBeVisible();
});

test("news category, keyword, article and site search", async ({ page }) => {
  await page.goto("/news");
  await page
    .getByRole("combobox", { name: "News category" })
    .selectOption("Legislative");
  await expect(page.locator(".news-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search news" }).fill("missingword");
  await expect(
    page.getByRole("heading", { name: "No matching results" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("textbox", { name: "Search news" }).fill("coastline");
  await page.getByRole("link", { name: "Read story" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "coastline",
  );
  await page.goto("/search");
  await page
    .getByRole("textbox", { name: "Search the municipal website" })
    .fill("business");
  await page
    .getByRole("link", { name: /Business Permits Information/ })
    .click();
  await expect(page).toHaveURL(/\/services\/business-permits$/);
});

test("session agenda, empty disclosure category, and unknown route", async ({
  page,
}) => {
  await page.goto("/legislative/sessions");
  const agenda = page.locator("details").first();
  await agenda.locator("summary").click();
  await expect(agenda.getByText("Call to order and roll call")).toBeVisible();
  await page.goto("/transparency/full-disclosure");
  await expect(
    page.getByRole("heading", { name: "Documents awaiting publication" }),
  ).toBeVisible();
  const response = await page.goto("/news/nonexistent-story");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Let’s get you back on track." }),
  ).toBeVisible();
});

test("all main routes render without overflow or broken images", async ({
  page,
}) => {
  const routes = [
    "/executive",
    "/executive/mayor",
    "/executive/departments",
    "/executive/programs",
    "/executive/activities",
    "/legislative",
    "/legislative/members",
    "/legislative/committees",
    "/legislative/public-hearings",
    "/services",
    "/contact",
    "/transparency",
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBeTruthy();
    const images = page.locator("img");
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(
          () =>
            img.evaluate(
              (i: HTMLImageElement) => i.complete && i.naturalWidth > 0,
            ),
          { message: route },
        )
        .toBeTruthy();
    }
  }
});
