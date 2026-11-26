import { test, expect, type Locator, type Page } from "@playwright/test";

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function clampedPreview(element: Locator, lines: number) {
  await expect(element).toBeVisible();
  const metrics = await element.evaluate(node => {
    const styles = getComputedStyle(node);
    return {
      clamp: styles.webkitLineClamp,
      overflow: styles.overflow,
      height: node.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(styles.lineHeight),
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
    };
  });
  expect(metrics.clamp).toBe(String(lines));
  expect(metrics.overflow).toBe("hidden");
  expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * lines + 2);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
}

test("Executive page shows four departments and compact previews with links to full content", async ({ page }, info) => {
  await page.route("**/_next/image**", route => route.fulfill({
    path: "public/images/logos/seal.png", contentType: "image/png",
  }));
  await page.goto("/executive");
  const leadership = page.locator(".department-directory-grid");
  await expect(leadership.locator(".department-card")).toHaveCount(4);
  await expect(leadership.locator("h2")).toHaveText([
    "MHO draft", "MENRO draft", "Treasury", "Engineering",
  ]);
  await expect(leadership).not.toContainText("Market Affairs");
  await expect(leadership).not.toContainText("Slaughter House");
  await expect(leadership).not.toContainText("Waterworks");
  const columns = await leadership.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(info.project.name === "mobile" ? 1 : 4);

  const program = page.locator(".program-card");
  const news = page.locator(".news-card");
  await expect(program).toHaveCount(1);
  await expect(news).toHaveCount(1);
  await clampedPreview(program.locator("h3"), 2);
  await clampedPreview(program.locator(":scope > p"), 3);
  await clampedPreview(news.locator("h3"), 2);
  await clampedPreview(news.locator(".news-card-body > p"), 3);
  await expect(program.getByRole("link", { name: "View more", exact: true })).toBeVisible();
  await expect(news.getByRole("link", { name: "Read full story", exact: true })).toBeVisible();
  await noOverflow(page);
  await leadership.screenshot({ path: info.outputPath("executive-four-departments.png") });
  await program.screenshot({ path: info.outputPath("executive-program-preview.png") });
  await news.screenshot({ path: info.outputPath("executive-news-preview.png") });

  const storyLink = news.getByRole("link", { name: "Read full story", exact: true });
  await storyLink.focus();
  await expect(storyLink).toBeFocused();
  await storyLink.press("Enter");
  await expect(page).toHaveURL(/\/news\/executive-preview-news$/);
  await expect(page.locator(".article-body")).toContainText("EXECUTIVE NEWS FULL DETAILS END.");
  await noOverflow(page);

  await page.goto("/executive");
  const programLink = page.locator(".program-card").getByRole("link", { name: "View more", exact: true });
  await programLink.focus();
  await expect(programLink).toBeFocused();
  await programLink.press("Enter");
  await expect(page).toHaveURL(/\/programs\/executive-preview-program$/);
  await expect(page.locator(".article-body")).toContainText("EXECUTIVE PROGRAM FULL DETAILS END.");
  await noOverflow(page);
});

test("program directory shares the compact preview and its full-content link", async ({ page }) => {
  await page.goto("/executive/programs");
  const card = page.locator(".program-card");
  await expect(card).toHaveCount(1);
  await clampedPreview(card.locator("h3"), 2);
  await clampedPreview(card.locator(":scope > p"), 3);
  const link = card.getByRole("link", { name: "View more", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/programs/executive-preview-program");
  await noOverflow(page);
});
