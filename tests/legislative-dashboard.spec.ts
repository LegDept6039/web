import { test, expect, type Page, type Locator } from "@playwright/test";

const legislative = "10000000-0000-4000-8000-000000000004";
const executive = "10000000-0000-4000-8000-000000000003";
const current = "20000000-0000-4000-8000-000000000001";
const previous = "20000000-0000-4000-8000-000000000002";
const dashboard = `/admin/content?office=${legislative}`;

async function login(page: Page, account: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(account);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    account === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(page.locator("#admin-navigation")).toBeAttached();
}

async function expectCounts(page: Page, counts: number[]) {
  const cards = page.locator(".legislative-summary-card");
  await expect(cards).toHaveCount(5);
  for (const [index, label] of [
    "Officials",
    "Ordinances",
    "Resolutions",
    "Sessions",
    "Documents",
  ].entries()) {
    const card = cards.filter({
      has: page.getByRole("heading", { name: label, exact: true }),
    });
    await expect(card.locator(".legislative-count")).toHaveText(
      String(counts[index]),
    );
  }
}

function table(page: Page, mode = "Resolutions") {
  return page.getByRole("table", {
    name: `${mode} authored and co-authored by official`,
    exact: true,
  });
}

async function expectAuthorship(
  authorship: Locator,
  name: string,
  counts: number[],
) {
  const row = authorship.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row.locator("th,td")).toHaveText([name, ...counts.map(String)]);
}

async function expectCenteredNumbers(authorship: Locator) {
  const numericCells = authorship.locator("tr > :nth-child(n+2)");
  await expect(numericCells).toHaveCount(10);
  for (const cell of await numericCells.all())
    await expect(cell).toHaveCSS("text-align", "center");
}

test("Legislative Access opens a five-card dashboard and switches authorship totals", async ({
  page,
}, info) => {
  await login(page, "vmo");
  await page.goto(dashboard);
  await expect(
    page.getByRole("heading", { name: "Legislative dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Legislative Term", { exact: true }),
  ).toHaveValue(current);
  await expectCounts(page, [5, 2, 3, 2, 2]);
  const types = page.getByRole("group", { name: "Document type", exact: true });
  await expect(
    types.getByRole("button", { name: "Resolutions", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(table(page).getByRole("row")).toHaveCount(5);
  await expect(table(page).getByRole("columnheader")).toHaveText([
    "Official",
    "Authored",
    "Co-authored",
  ]);
  await expect(table(page)).not.toContainText("Dashboard Vice Mayor");
  await expectCenteredNumbers(table(page));
  await expectAuthorship(table(page), "Dashboard Official A", [2, 1]);
  await expectAuthorship(table(page), "Dashboard Official B", [1, 1]);
  await expectAuthorship(table(page), "Dashboard Zero Official", [0, 0]);
  await expectAuthorship(table(page), "Dashboard Draft Official", [0, 0]);
  await expect(table(page)).not.toContainText("Dashboard Foreign Official");
  await expect(table(page)).not.toContainText("Dashboard Previous Official");
  await types.getByRole("button", { name: "Ordinances", exact: true }).click();
  await expect(
    types.getByRole("button", { name: "Ordinances", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(table(page, "Ordinances")).not.toContainText(
    "Dashboard Vice Mayor",
  );
  await expectCenteredNumbers(table(page, "Ordinances"));
  await expectAuthorship(
    table(page, "Ordinances"),
    "Dashboard Official A",
    [0, 1],
  );
  await expectAuthorship(
    table(page, "Ordinances"),
    "Dashboard Official B",
    [2, 0],
  );
  await expectAuthorship(
    table(page, "Ordinances"),
    "Dashboard Zero Official",
    [0, 0],
  );
  const resolutions = types.getByRole("button", {
    name: "Resolutions",
    exact: true,
  });
  await resolutions.focus();
  await expect(resolutions).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(resolutions).toHaveAttribute("aria-pressed", "true");
  await expectAuthorship(table(page), "Dashboard Official A", [2, 1]);
  await expectCounts(page, [5, 2, 3, 2, 2]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("legislative-dashboard.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  const officeLinks = page.locator(`#office-${legislative}`);
  await expect(officeLinks.getByRole("link").first()).toHaveText("Dashboard");
  await expect(
    officeLinks.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("term selection changes summaries, table rows, and linked collection terms", async ({
  page,
}) => {
  await login(page, "vmo");
  await page.goto(dashboard);
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption(previous);
  await expectCounts(page, [1, 1, 1, 1, 1]);
  await expectAuthorship(table(page), "Dashboard Previous Official", [1, 0]);
  await expect(table(page).getByRole("row")).toHaveCount(2);
  await expect(
    page.locator(".legislative-summary-card").first(),
  ).toHaveAttribute(
    "href",
    `/admin/content/officials?office=${legislative}&term=${previous}`,
  );
  await page
    .getByLabel("Legislative Term", { exact: true })
    .selectOption("unassigned");
  await expectCounts(page, [1, 0, 0, 1, 0]);
  await expectAuthorship(
    table(page),
    "Dashboard Unassigned Official",
    [0, 0],
  );
  await expect(table(page).getByRole("row")).toHaveCount(2);
});

for (const account of ["viewer", "superadmin"]) {
  test(`${account} can read assigned Legislative statistics without a write action`, async ({
    page,
  }) => {
    await login(page, account);
    await page.goto(dashboard);
    await expectCounts(page, [5, 2, 3, 2, 2]);
    await expectAuthorship(table(page), "Dashboard Official A", [2, 1]);
    await expect(
      page
        .locator("main")
        .getByRole("button", { name: /save|delete|publish/i }),
    ).toHaveCount(0);
  });
}

test("Executive and unassigned users cannot forge the Legislative dashboard URL", async ({
  page,
}, info) => {
  await login(page, "restricted");
  await page.goto(`/admin/content?office=${executive}`);
  await expect(
    page.getByRole("heading", { name: "MAYOR draft", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".legislative-summary-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Authorship by official", exact: true }),
  ).toHaveCount(0);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator(`#office-${legislative}`)).toHaveCount(0);
  await page.goto(dashboard);
  await expect(page.locator("#main").getByRole("alert")).toContainText(
    "This office is unavailable or you do not have access.",
  );
  await expect(page.locator(".legislative-summary-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Username", { exact: true }).fill("no-membership");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Your staff account has no active department assignment. Ask your administrator to assign Office Access.",
  );
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(dashboard);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".legislative-summary-card")).toHaveCount(0);
});

test("dashboard navigation keeps the shared loading state responsive", async ({
  page,
}, info) => {
  await login(page, "vmo");
  await page.goto(`/admin/content/officials?office=${legislative}`);
  await expect(page.locator(".admin-table")).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .locator(`#office-${legislative}`)
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  const loading = page
    .locator("#main")
    .getByRole("status", { name: "Loading administration", exact: true });
  await expect(loading).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(loading.locator(".skeleton").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("legislative-dashboard-loading.png"),
    fullPage: true,
  });
  await expectCounts(page, [5, 2, 3, 2, 2]);
  await expect(loading).toHaveCount(0);
});
