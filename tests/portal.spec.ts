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
  // Mock records have no term assignment; use the historical browsing option.
  await page.goto("/legislative/ordinances?term=unassigned");
  await expect(page.locator(".legislative-table tbody tr")).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Filter by year" })
    .selectOption("2025");
  await expect(page.locator(".legislative-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".legislative-table tbody tr")).toContainText(
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
  await expect(page.locator(".legislative-table tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "View record" }).click();
  await expect(
    page.getByRole("heading", { name: "Ordinance No. 01-2026", exact: true }),
  ).toBeVisible();
  const pdf = page.getByRole("link", { name: "View PDF document" });
  await expect(pdf).toBeVisible();
  const response = await page.request.get((await pdf.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
});

test("resolution co-author and year searches", async ({ page }) => {
  await page.goto("/legislative/resolutions?term=unassigned");
  await page
    .getByRole("combobox", { name: "Filter by year" })
    .selectOption("2025");
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("year") === "2025",
  );
  await expect(page.locator(".legislative-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Search resolutions" })
    .fill("Sample Council Member C");
  await page
    .getByRole("textbox", { name: "Search resolutions" })
    .press("Enter");
  await expect(page.locator(".legislative-table tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "View record" }).click();
  await expect(page.getByText("Co-author", { exact: true })).toBeVisible();
});

test("news department, keyword, article and site search", async ({ page }) => {
  await page.goto("/news");
  await page
    .getByRole("combobox", { name: "Department", exact: true })
    .selectOption({ label: "Municipal information portal" });
  await expect(page.locator(".news-card")).toHaveCount(5);
  await expect(
    page.getByRole("combobox", { name: "News category" }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search news" }).fill("missingword");
  await expect(
    page.getByRole("heading", { name: "No matching results" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("textbox", { name: "Search news" }).fill("coastline");
  await page.getByRole("link", { name: "Read full story" }).click();
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
  // Next.js can stream the loading boundary before resolving an unknown dynamic record.
  expect([200, 404]).toContain(response?.status());
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toBeAttached();
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

test("compact legislative tables prioritize full long titles on both screen sizes", async ({
  page,
}, info) => {
  for (const kind of ["ordinances", "resolutions"]) {
    await page.goto(`/legislative/${kind}?term=unassigned`);
    // Exercise a client filter first so hydration cannot overwrite the stress-test text.
    const number = await page
      .locator(".legislative-table tbody tr td")
      .first()
      .innerText();
    await page.getByRole("textbox", { name: `Search ${kind}` }).fill(number);
    if (kind === "resolutions")
      await page
        .getByRole("textbox", { name: "Search resolutions" })
        .press("Enter");
    await expect(page.locator(".legislative-table tbody tr")).toHaveCount(1);
    const title = page.locator(".record-title h2").first();
    const long =
      "AN ORDINANCE ESTABLISHING COMPREHENSIVE COMMUNITY HEALTH AND ENVIRONMENTAL PROTECTION SERVICES ".repeat(
        8,
      );
    await title.evaluate((element, text) => {
      element.textContent = text;
    }, long);
    await expect(title).toHaveText(long.trim());
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const size = await title.boundingBox();
    expect(size?.height).toBeGreaterThan(40);
    if (info.project.name !== "mobile") {
      const cell = await page.locator(".record-title").first().boundingBox();
      const table = await page.locator(".legislative-table").boundingBox();
      expect(cell!.width / table!.width).toBeGreaterThan(0.6);
    }
    await page.screenshot({
      path: info.outputPath(`${kind}-compact.png`),
      fullPage: true,
    });
  }
});

test("dropdown dismissal, focus, route aliases and activity department filter", async ({
  page,
}, info) => {
  await page.goto("/");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  const executive = page.getByRole("button", {
    name: "Executive",
    exact: true,
  });
  const legislative = page.getByRole("button", {
    name: "Legislative",
    exact: true,
  });
  await executive.click();
  await expect(executive).toHaveAttribute("aria-expanded", "true");
  await executive.click();
  await expect(executive).toHaveAttribute("aria-expanded", "false");
  await executive.click();
  await legislative.click();
  await expect(executive).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(legislative).toBeFocused();
  await expect(legislative).toHaveAttribute("aria-expanded", "false");
  await executive.click();
  await page.locator("main h1").click();
  await expect(
    page.locator('button[aria-controls="menu-Executive"]'),
  ).toHaveAttribute("aria-expanded", "false");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await executive.click();
  await page
    .locator("#menu-Executive")
    .getByRole("link", { name: "Municipal Mayor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/mayor$/);
  await expect(
    page.getByRole("link", { name: "View Executive Departments" }),
  ).toHaveAttribute("href", "/departments");
  await page.goto("/activities");
  await expect(
    page.getByRole("combobox", { name: "Department", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "News category" }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search news" })
    .fill("no-such-activity-123");
  await expect(page.getByText("No matching results")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("activities-filter.png"),
    fullPage: true,
  });
});

test("news directory cards align and clamp long excerpts at responsive widths", async ({
  page,
}, info) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/news");
    const cards = page.locator(".news-grid-uniform .news-card");
    expect(await cards.count()).toBeGreaterThan(1);
    const excerpt = cards.first().locator(".news-card-body > p");
    await expect(excerpt).toBeVisible();
    await excerpt.evaluate((el) => {
      el.textContent =
        "Long news excerpt for checking readable card layout. ".repeat(25);
    });
    const size = await excerpt.evaluate((el) => ({
      visible: el.clientHeight,
      full: el.scrollHeight,
    }));
    expect(size.full).toBeGreaterThan(size.visible);
    if (width >= 768) {
      const boxes = await cards.evaluateAll((els) =>
        els.map((el) => ({ height: el.getBoundingClientRect().height })),
      );
      expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThan(2);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`news-cards-${width}.png`),
      fullPage: true,
    });
  }
});
