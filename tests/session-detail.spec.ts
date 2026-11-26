import { test, expect, type Page } from "@playwright/test";

const sessionUrl = "/legislative/sessions/session-detail-main";
const ordinanceUrl = "/legislative/ordinances/session-detail-ordinance";
const resolutionUrl = "/legislative/resolutions/session-detail-resolution";
const titleFinalClause =
  "AND PROVIDING FOR REGULAR REVIEW OF THE RESULTS AND CONTINUED MUNICIPAL SUPPORT";

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("session directory opens its own page with the day's linked measures, agenda and minutes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/legislative/sessions");
  const sessionLink = page.locator(`a[href="${sessionUrl}"]`).first();
  await expect(sessionLink).toBeVisible();
  await sessionLink.focus();
  await expect(sessionLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(sessionUrl);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "66th Regular Session",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("November 9, 2026");
  for (const name of [
    "Ordinances",
    "Resolutions",
    "Session agenda",
    "Session minutes",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();

  const ordinance = page.locator(`main a[href="${ordinanceUrl}"]`).first();
  const resolution = page.locator(`main a[href="${resolutionUrl}"]`).first();
  await expect(ordinance).toBeVisible();
  await expect(resolution).toBeVisible();
  const titlePreview = ordinance
    .locator("xpath=ancestor::tr")
    .locator("td:nth-child(2) > p")
    .first();
  const previewGeometry = await titlePreview.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      whiteSpace: style.whiteSpace,
      lineHeight: Number.parseFloat(style.lineHeight),
      height: node.getBoundingClientRect().height,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      sourceText: node.textContent || "",
    };
  });
  expect(previewGeometry.whiteSpace).toBe("normal");
  expect(previewGeometry.height).toBeLessThanOrEqual(
    previewGeometry.lineHeight * 2 + 1,
  );
  expect(previewGeometry.scrollHeight).toBeGreaterThan(
    previewGeometry.clientHeight,
  );
  expect(previewGeometry.sourceText).toContain("\n");
  expect(previewGeometry.sourceText).toContain(titleFinalClause);
  const hero = await page.locator("main .page-hero").boundingBox();
  expect(hero).not.toBeNull();
  expect(hero!.height).toBeLessThanOrEqual(
    info.project.name === "mobile" ? 180 : 190,
  );
  await expect(page.locator("main")).toContainText("Session Member A");
  await expect(page.locator("main")).toContainText("Session Member B");
  await expect(page.locator("main")).toContainText("Mass motion");
  await expect(page.locator("main")).not.toContainText("Excluded measure");
  await expect(page.locator("main")).not.toContainText("Excluded attachment");
  await expect(page.locator("main")).toContainText(
    "Agenda for the 66th Regular Session",
  );
  await expect(page.locator("main")).toContainText(
    "Minutes of the 66th Regular Session",
  );
  await expect(page.locator("main")).toContainText(
    "Supplementary session minutes",
  );
  await expect(page.locator("main")).toContainText(
    "Call to order and roll call",
  );
  for (const kind of ["agenda", "minutes"]) {
    const attachment = page.locator(
      `main a[href="https://records.example.test/session-detail-${kind}.pdf"]`,
    );
    await expect(attachment).toBeVisible();
    await expect(attachment).toHaveAttribute("target", "_blank");
    await expect(attachment).toHaveAttribute("rel", /noreferrer|noopener/);
  }
  await expect(page.locator('main a[href^="javascript:"]')).toHaveCount(0);
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: info.outputPath("session-detail.png"),
    fullPage: true,
  });

  await ordinance.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(ordinanceUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ordinance No. 129-2026",
  );
  const fullTitle = page.locator("main .page-hero > .container > p");
  await expect(fullTitle).toContainText(titleFinalClause);
  expect(
    await fullTitle.evaluate((node) => node.scrollHeight <= node.clientHeight),
  ).toBe(true);
  await expect(page.locator("main")).toContainText(
    "Full approved ordinance text for the session record.",
  );
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "66th Regular Session",
  );
  await page.locator(`main a[href="${resolutionUrl}"]`).first().click();
  await expect(page).toHaveURL(resolutionUrl);
  await expect(page.locator("main")).toContainText("Mass motion");
  await expect(page.locator("main")).not.toContainText("Session Member A");
  await page.goBack();
  await expect(page).toHaveURL(sessionUrl);
  for (const [id, title] of [
    ["session-detail-agenda", "Agenda for the 66th Regular Session"],
    ["session-detail-minutes", "Minutes of the 66th Regular Session"],
  ]) {
    await page.locator(`main a[href="/legislative/documents/${id}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.locator(`main a[href="${sessionUrl}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "66th Regular Session",
    );
  }
  expect(errors).toEqual([]);
});

test("empty sessions have useful states and same-day sessions retain their own linked records", async ({
  page,
}, info) => {
  await page.goto("/legislative/sessions/session-detail-empty");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "67th Regular Session",
  );
  for (const name of [
    "Ordinances",
    "Resolutions",
    "Session agenda",
    "Session minutes",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.locator('main a[href^="/legislative/ordinances/"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('main a[href^="/legislative/resolutions/"]'),
  ).toHaveCount(0);
  await expect(page.locator("main")).toContainText(
    /No .*ordinances|ordinances .*yet/i,
  );
  await expect(page.locator("main")).toContainText(
    /No .*resolutions|resolutions .*yet/i,
  );
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: info.outputPath("session-empty.png"),
    fullPage: true,
  });

  await page.goto("/legislative/sessions/session-detail-same-day");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Special Session on the Same Day",
  );
  await expect(page.locator(`main a[href="${ordinanceUrl}"]`)).toHaveCount(0);
  await expect(page.locator(`main a[href="${resolutionUrl}"]`)).toHaveCount(0);
  await expect(page.locator("main")).toContainText(
    "Excluded measure other-session",
  );
  await expect(page.locator("main")).toContainText(
    "Excluded attachment other-session",
  );
  await expect(page.locator("main")).not.toContainText(
    "Excluded measure unlinked",
  );
  await expectNoPageOverflow(page);
});

test("unknown, unpublished and foreign sessions do not expose detail pages", async ({
  page,
}) => {
  for (const id of [
    "does-not-exist",
    "session-detail-hidden",
    "session-detail-foreign",
  ]) {
    const response = await page.goto(`/legislative/sessions/${id}`);
    // Next's notFound() returns 200 after a streamed layout has already begun.
    expect([200, 404]).toContain(response?.status());
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Let’s get you back on track.",
    );
    await expect(
      page.locator('meta[name="robots"][content*="noindex"]').first(),
    ).toBeAttached();
    await expect(page.locator("main")).not.toContainText(
      "Council deliberations and approved municipal measures.",
    );
    await expect(page.locator(`main a[href="${ordinanceUrl}"]`)).toHaveCount(0);
  }
});
