import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const currentTerm = "20000000-0000-4000-8000-000000000001";
const previousTerm = "20000000-0000-4000-8000-000000000002";
const archive = "/legislative/resolutions";
const statePath = "tmp/resolution-archive-state.json";
const logPath = "tmp/resolution-archive-requests.jsonl";
const recordPath = `${archive}/archive-resolution-118`;

function transportRequests() {
  return readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          table: string;
          url: string;
          count: number;
          returned: number;
          cache: string;
        },
    );
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

async function search(page: Page, query: string) {
  const field = page.getByRole("textbox", { name: "Search resolutions" });
  await field.fill(query);
  await field.press("Enter");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === query);
}

test.beforeEach(() => {
  mkdirSync("tmp", { recursive: true });
  writeFileSync(statePath, "{}");
  writeFileSync(logPath, "");
});

test("archive pages and filters all matching published records before slicing", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${archive}?term=${currentTerm}`);
  const rows = page.locator(".legislative-table tbody tr");
  await expect(rows).toHaveCount(25);
  expect(await response!.text()).not.toContain(
    "Full verified text for Resolution",
  );
  await expect(page.locator(".results-count")).toContainText(
    "142 resolutions found",
  );
  await expect(
    page.getByRole("combobox", { name: "Legislative Term" }),
  ).toHaveValue(currentTerm);
  await expect(
    page.getByRole("combobox", { name: "Filter by year" }),
  ).toHaveValue("all");
  await expect(page.locator("main")).not.toContainText("PRIVATE DRAFT");
  await expect(page.locator("main")).not.toContainText("EXECUTIVE ONLY");
  const firstNumber = await rows.first().locator("td").first().innerText();
  const pagination = page.getByRole("navigation", {
    name: "Resolutions pagination",
  });
  await expect(pagination).toContainText("Page 1 of 6");
  await expect(
    pagination.getByRole("link", { name: "Previous page" }),
  ).toHaveCount(0);
  await pagination.getByRole("link", { name: "Next page" }).focus();
  await expect(
    pagination.getByRole("link", { name: "Next page" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2");
  await expect(rows).toHaveCount(25);
  await expect(pagination).toContainText("Page 2 of 6");
  expect(await rows.first().locator("td").first().innerText()).not.toBe(
    firstNumber,
  );
  await expectNoOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("archive-viewport.png") });
  await page.screenshot({
    path: info.outputPath("archive-page-2.png"),
    fullPage: true,
  });

  // This co-author's sole record is deliberately outside the first 25 results.
  await search(page, "Marmie Jeanne");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("232-2026");
  await expect(page.locator(".results-count")).toContainText(
    "1 resolutions found",
  );
  await expect(page).toHaveURL((url) => !url.searchParams.has("page"));
  await page
    .getByRole("combobox", { name: "Filter by year" })
    .selectOption("2025");
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("year") === "2025",
  );
  await expect(rows).toHaveCount(0);
  await expect(page.locator(".results-count")).toContainText(
    "0 resolutions found",
  );
  await page.getByRole("link", { name: "Reset", exact: true }).click();
  await expect(rows).toHaveCount(25);
  await expect(
    page.getByRole("textbox", { name: "Search resolutions" }),
  ).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "Filter by year" }),
  ).toHaveValue("all");
  await expect(page.locator(".results-count")).toContainText(
    "142 resolutions found",
  );

  await search(page, "Mass motion");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Approval: Mass motion");
  await page.getByRole("link", { name: "Reset", exact: true }).click();
  await pagination.getByRole("link", { name: "Next page" }).click();
  await page
    .getByRole("combobox", { name: "Legislative Term" })
    .selectOption(previousTerm);
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("term") === previousTerm &&
      !url.searchParams.has("page"),
  );
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("232-2024");
  await expect(page.locator(".results-count")).toContainText(
    "1 resolutions found",
  );
  await page
    .getByRole("combobox", { name: "Legislative Term" })
    .selectOption("unassigned");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Unassigned historical resolution");

  const listRequests = transportRequests().filter((request) => {
    const params = new URL(request.url).searchParams;
    return (
      request.table === "resolutions" &&
      params.get("select") !== "year" &&
      !params.has("id")
    );
  });
  expect(listRequests.length).toBeGreaterThan(4);
  for (const request of listRequests) {
    const params = new URL(request.url).searchParams;
    expect(Number(params.get("limit"))).toBeLessThanOrEqual(25);
    expect(request.returned).toBeLessThanOrEqual(25);
    expect(params.get("select")).not.toMatch(
      /summary|pdf_url|session_record|committee_record/,
    );
    expect(params.get("published")).toBe("eq.true");
    expect(params.get("content_scope")).toBe("eq.legislative");
    expect(request.cache).toBe("no-store");
  }
  expect(
    transportRequests().filter((request) => request.table === "officials"),
  ).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("record navigation is soft, single-record, and restores filters and page", async ({
  page,
}, info) => {
  const source = `${archive}?term=${currentTerm}&year=2026&q=APPROVING&page=5`;
  await page.goto(source);
  await expect(page.locator(".results-count")).toContainText(
    "102 resolutions found",
  );
  await expect(page.locator(".legislative-table tbody tr")).toHaveCount(2);
  const row = page
    .locator(".legislative-table tbody tr")
    .filter({ hasText: "232-2026" });
  await expect(row).toHaveCount(1);
  const view = row.getByRole("link", { name: "View record" });
  const href = new URL(
    (await view.getAttribute("href"))!,
    "http://127.0.0.1:3041",
  );
  expect(href.pathname).toBe(recordPath);
  expect(href.searchParams.get("returnTo")).toBe(source);
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documentRequests.push(request.url());
  });
  await page.evaluate(() =>
    Object.assign(window, { archiveNavigationMarker: "same-document" }),
  );
  await view.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Resolution No. 232-2026",
  );
  await expect(page.locator(".record-body")).toContainText(
    "Full verified text for Resolution No. 232-2026.",
  );
  expect(documentRequests).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { archiveNavigationMarker?: string })
          .archiveNavigationMarker,
    ),
  ).toBe("same-document");
  const detailRequests = transportRequests().filter(
    (request) =>
      request.table === "resolutions" &&
      new URL(request.url).searchParams.has("id"),
  );
  expect(detailRequests.length).toBeGreaterThan(0);
  expect(
    detailRequests.some(
      (request) =>
        new URL(request.url).searchParams.get("id") ===
        "eq.archive-resolution-118",
    ),
  ).toBe(true);
  for (const request of detailRequests) {
    const params = new URL(request.url).searchParams;
    // Visible links may prefetch another record. Each fetch must still target
    // one ID, rather than download the entire collection to find it.
    expect(params.get("id")).toMatch(/^eq\.archive-resolution-\d+$/);
    expect(params.get("limit")).toBe("1");
    expect(request.returned).toBe(1);
    expect(request.cache).toBe("no-store");
  }
  const back = page.getByRole("link", {
    name: "Back to resolutions",
    exact: true,
  });
  await expect(back).toHaveAttribute("href", source);
  await expectNoOverflow(page);
  await page.screenshot({
    path: info.outputPath("resolution-232.png"),
    fullPage: true,
  });
  await page.goBack();
  await expect(page).toHaveURL(source);
  await expect(
    page.getByRole("textbox", { name: "Search resolutions" }),
  ).toHaveValue("APPROVING");
  await expect(
    page.getByRole("combobox", { name: "Filter by year" }),
  ).toHaveValue("2026");
  await expect(
    page.getByRole("navigation", { name: "Resolutions pagination" }),
  ).toContainText("Page 5 of 5");
  await row.getByRole("link", { name: "View record" }).click();
  await back.click();
  await expect(page).toHaveURL(source);
  await expectNoOverflow(page);

  for (const returnTo of [
    "https://example.test/steal",
    "//example.test/steal",
    "/admin",
    `${archive}?term=${currentTerm}&preview=1`,
  ]) {
    await page.goto(`${recordPath}?${new URLSearchParams({ returnTo })}`);
    await expect(back).toHaveAttribute("href", archive);
  }
});

test("fresh public requests reflect correction, publication, and unpublication", async ({
  page,
}) => {
  await page.goto(`${archive}?term=${currentTerm}&q=232-2026`);
  await expect(page.locator(".results-count")).toContainText(
    "1 resolutions found",
  );
  await page
    .locator(".legislative-table")
    .getByRole("link", { name: "View record" })
    .click();
  await expect(page.locator(".record-body")).toContainText(
    "Full verified text",
  );
  writeFileSync(
    statePath,
    JSON.stringify({
      records: {
        "archive-resolution-118": {
          title: "Corrected public resolution title",
          summary: "Corrected verified full resolution text.",
        },
        "archive-draft": { published: true },
      },
    }),
  );
  await page.reload();
  await expect(page.locator("main .page-hero")).toContainText(
    "Corrected public resolution title",
  );
  await expect(page.locator(".record-body")).toContainText(
    "Corrected verified full resolution text.",
  );
  await page.goto(`${archive}?term=${currentTerm}&q=Corrected`);
  await expect(page.locator(".legislative-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".legislative-table")).toContainText(
    "Corrected public resolution title",
  );
  await page.goto(`${archive}?term=${currentTerm}`);
  await expect(page.locator(".results-count")).toContainText(
    "143 resolutions found",
  );
  writeFileSync(
    statePath,
    JSON.stringify({
      records: { "archive-resolution-118": { published: false } },
    }),
  );
  await page.goto(`${archive}?term=${currentTerm}&q=232-2026`);
  await expect(page.locator(".results-count")).toContainText(
    "0 resolutions found",
  );
  await page.goto(recordPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Let’s get you back on track.",
  );
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toBeAttached();
  await expect(page.locator(".record-body")).toHaveCount(0);
});
