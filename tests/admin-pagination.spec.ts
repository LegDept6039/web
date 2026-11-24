import { test, expect, type Page, type Locator } from "@playwright/test";

const office = "10000000-0000-4000-8000-000000000004";
const current = "20000000-0000-4000-8000-000000000001";
const previous = "20000000-0000-4000-8000-000000000002";
const rows = (page: Page) => page.locator("main .admin-table tbody tr");
const pager = (page: Page) => page.locator("main nav.admin-pagination");

async function signIn(page: Page, account = "legislative-editor") {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(account);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    account === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(page.locator("main h1")).toBeVisible();
}

async function expectRange(
  nav: Locator,
  start: number,
  end: number,
  total: number,
) {
  await expect(nav).toContainText(`Showing ${start}\u2013${end} of ${total}`);
}

async function expectPageQuery(page: Page, params: Record<string, string>) {
  await expect
    .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
    .toMatchObject(params);
}

async function fits(nav: Locator) {
  expect(
    await nav.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return (
        element.scrollWidth <= element.clientWidth + 1 &&
        box.left >= -1 &&
        box.right <= window.innerWidth + 1
      );
    }),
  ).toBe(true);
}

test("office lists paginate in order, clamp invalid pages and reset when the term changes", async ({
  page,
}, info) => {
  await signIn(page);
  for (const [collection, label] of [
    ["officials", "Official"],
    ["sessions", "Session"],
  ]) {
    await page.goto(
      `/admin/content/${collection}?office=${office}&term=${current}`,
    );
    const nav = page.getByRole("navigation", { name: "Content pagination" });
    await expectRange(nav, 1, 25, 31);
    await expect(rows(page)).toHaveCount(25);
    await expect(rows(page).first()).toContainText(`Pagination ${label} 01`);
    await expect(rows(page).last()).toContainText(`Pagination ${label} 25`);
    await expect(
      page.getByText("Foreign Office Official", { exact: true }),
    ).toHaveCount(0);
    await expect(nav.getByText("Previous", { exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await nav.getByRole("link", { name: "Page 2", exact: true }).click();
    await expectRange(nav, 26, 31, 31);
    await expect(rows(page)).toHaveCount(6);
    await expect(rows(page).first()).toContainText(`Pagination ${label} 26`);
    await expectPageQuery(page, { page: "2", office, term: current });
    await expect(nav.getByText("Next", { exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await fits(nav);
    if (collection === "officials")
      await nav.screenshot({ path: info.outputPath("content-pagination.png") });
    await page.goto(
      `/admin/content/${collection}?office=${office}&term=${current}&page=9999`,
    );
    await expectRange(nav, 26, 31, 31);
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
      "aria-label",
      "Page 2",
    );
    await page
      .getByRole("combobox", { name: "Legislative Term", exact: true })
      .selectOption(previous);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(`Previous Term ${label}`);
    await expectRange(nav, 1, 1, 1);
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  }
});

test("document paging preserves office, term, type, search and sort while new filters reset the page", async ({
  page,
}, info) => {
  await signIn(page);
  await page.goto(
    `/admin/content/documents?office=${office}&term=${current}&type=executive-order&q=Pagination&sort=title`,
  );
  const nav = page.getByRole("navigation", { name: "Documents pagination" });
  await expectRange(nav, 1, 25, 31);
  await nav.getByRole("link", { name: "Next", exact: true }).click();
  await expectRange(nav, 26, 31, 31);
  await expect(rows(page)).toHaveCount(6);
  await expect(rows(page).first()).toContainText("Pagination Report 26");
  await expectPageQuery(page, {
    office,
    term: current,
    type: "executive-order",
    q: "Pagination",
    sort: "title",
    page: "2",
  });
  await expect(
    page.getByText("Agenda Outside EO Filter", { exact: true }),
  ).toHaveCount(0);
  await fits(nav);
  await page.screenshot({
    path: info.outputPath("document-page-two.png"),
    fullPage: true,
  });
  await page.getByLabel("Search title", { exact: true }).fill("Report 01");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expectRange(nav, 1, 1, 1);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Pagination Report 01");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await page
    .getByLabel("Search title", { exact: true })
    .fill("no-matching-report");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expectRange(nav, 0, 0, 0);
  await expect(rows(page)).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveCount(0);
});

test("committee catalog and preserved compositions page independently and reset for another term", async ({
  page,
}, info) => {
  await signIn(page);
  await page.goto(`/admin/content/committees?office=${office}&term=${current}`);
  const catalog = page.getByRole("navigation", {
    name: "Committee pagination",
    exact: true,
  });
  const historical = page.getByRole("navigation", {
    name: "Historical committee pagination",
    exact: true,
  });
  const tables = page.locator("main .admin-table");
  await expectRange(catalog, 1, 25, 31);
  await expectRange(historical, 1, 25, 27);
  await catalog.getByRole("link", { name: "Page 2", exact: true }).click();
  await expect(tables.nth(0).locator("tbody tr")).toHaveCount(6);
  await expect(tables.nth(0).locator("tbody tr").first()).toContainText(
    "Pagination Committee 26",
  );
  await historical.getByRole("link", { name: "Page 2", exact: true }).click();
  await expectRange(catalog, 26, 31, 31);
  await expectRange(historical, 26, 27, 27);
  await expectPageQuery(page, {
    office,
    term: current,
    page: "2",
    historicalPage: "2",
  });
  await expect(tables.nth(1).locator("tbody tr")).toHaveCount(2);
  await expect(tables.nth(1)).toContainText("Preserved Committee 26");
  await fits(catalog);
  await fits(historical);
  await catalog.screenshot({
    path: info.outputPath("committee-pagination.png"),
  });
  await page
    .getByRole("combobox", { name: "Legislative Term", exact: true })
    .selectOption(previous);
  await expectRange(catalog, 1, 25, 31);
  await expect(historical).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  expect(new URL(page.url()).searchParams.has("historicalPage")).toBe(false);
  await expect(tables.nth(0).locator("tbody tr").first()).toContainText(
    "Unassigned template",
  );
});

test("Transparency and Superadmin tables share bounded, responsive page controls", async ({
  page,
}, info) => {
  await signIn(page, "superadmin");
  await page.goto(
    "/admin/transparency?module=pagination-module-01&year=2026&q=Quarterly",
  );
  await expectRange(pager(page), 1, 25, 31);
  await pager(page).getByRole("link", { name: "Page 2", exact: true }).click();
  await expectRange(pager(page), 26, 31, 31);
  await expectPageQuery(page, {
    module: "pagination-module-01",
    year: "2026",
    q: "Quarterly",
    page: "2",
  });
  await expect(rows(page).first()).toContainText("Quarterly Budget 26");
  await page
    .getByRole("combobox", { name: "Year", exact: true })
    .selectOption("2025");
  await page
    .getByRole("combobox", { name: "Module", exact: true })
    .selectOption("pagination-module-02");
  await page
    .getByRole("searchbox", { name: "Search reports", exact: true })
    .fill("");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expectRange(pager(page), 1, 1, 1);
  await expect(rows(page)).toContainText("Previous Year Budget");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  for (const [path, total, pageSize] of [
    ["/admin/transparency/modules", 31, 25],
    ["/superadmin/master-committees", 31, 25],
    ["/superadmin/legislative-terms", 31, 25],
    ["/superadmin/users", 46, 25],
    ["/superadmin/departments", 38, 25],
    ["/superadmin/audit", 55, 50],
  ] as const) {
    await page.goto(path);
    await expectRange(pager(page), 1, pageSize, total);
    await expect(rows(page)).toHaveCount(pageSize);
    await pager(page)
      .getByRole("link", { name: "Page 2", exact: true })
      .click();
    await expectRange(pager(page), pageSize + 1, total, total);
    await expect(rows(page)).toHaveCount(total - pageSize);
    await fits(pager(page));
    await expect(
      pager(page).getByText("Next", { exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
    if (path === "/admin/transparency/modules")
      await pager(page).screenshot({
        path: info.outputPath("transparency-pagination.png"),
      });
    await page.goto(`${path}?page=9999`);
    await expectRange(pager(page), pageSize + 1, total, total);
  }
});
