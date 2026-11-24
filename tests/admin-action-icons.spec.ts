import { test, expect, type Page, type Locator } from "@playwright/test";

const sb = "10000000-0000-4000-8000-000000000004";
const mho = "10000000-0000-4000-8000-000000000005";
const term = "20000000-0000-4000-8000-000000000001";
const legislative = (collection: string) =>
  `/admin/content/${collection}?office=${sb}&term=${term}`;

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    username === "superadmin" ? /\/superadmin$/ : /\/admin$/,
  );
  await expect(page.locator("main h1")).toBeVisible();
}

function canonicalHref(href: string, base: string) {
  const value = new URL(href, base);
  value.searchParams.sort();
  value.hash = "";
  return value.href;
}

async function auditControl(control: Locator) {
  const label = await control.getAttribute("aria-label");
  expect(label).toBeTruthy();
  await expect(control).toHaveAttribute("title", label!);
  await expect(control).toHaveClass(/admin-row-action/);
  await expect(control).toHaveText("");
  await expect(control.locator("svg")).toHaveCount(1);
  await expect(control.locator("svg")).toHaveAttribute("aria-hidden", "true");
}

async function auditActionTables(page: Page, allowReadOnly = false) {
  await expect(page.locator("main h1")).toBeVisible();
  const tables = page.locator("main table");
  expect(await tables.count()).toBeGreaterThan(0);
  let rowsAudited = 0;
  for (const table of await tables.all()) {
    const headers = await table.locator("thead th").allTextContents();
    const column = headers.findIndex((text) => /^Actions?$/.test(text.trim()));
    if (column < 0) continue;
    for (const row of await table.locator("tbody tr").all()) {
      const cell = row.locator("td").nth(column);
      const controls = cell.locator("a[href], summary");
      if (!allowReadOnly) expect(await controls.count()).toBeGreaterThan(0);
      for (const control of await controls.all()) await auditControl(control);
      const hrefs = await row
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href")!),
        );
      const canonical = hrefs.map((href) => canonicalHref(href, page.url()));
      expect(
        new Set(canonical).size,
        "a row must not repeat the same destination",
      ).toBe(canonical.length);
      rowsAudited++;
    }
  }
  expect(rowsAudited).toBeGreaterThan(0);
}

test("Superadmin CMS lists expose named icon actions without duplicate destinations", async ({
  page,
}, info) => {
  await signIn(page, "superadmin");
  const routes = [
    "/superadmin/users",
    "/superadmin/departments",
    "/superadmin/barangays",
    "/superadmin/barangays/sk",
    "/superadmin/legislative-terms",
    "/superadmin/master-committees",
    "/admin/barangays",
    ...["departments", "news", "programs", "services", "contacts"].map(
      (collection) => `/admin/content/${collection}?office=${mho}`,
    ),
    ...[
      "officials",
      "sessions",
      "committees",
      "hearings",
      "ordinances",
      "resolutions",
      "documents",
    ].map(legislative),
  ];
  for (const route of routes) {
    await page.goto(route);
    await auditActionTables(page);
  }
  await page.goto("/superadmin/users");
  const user = page.locator("tbody tr").filter({
    has: page.locator("td:nth-child(2)").filter({ hasText: /^editor$/ }),
  });
  const edit = user.getByRole("link", { name: "Edit", exact: true });
  await expect(user.getByRole("link")).toHaveCount(1);
  await expect(edit).toHaveAttribute(
    "href",
    "/superadmin/users/00000000-0000-4000-8000-000000000002",
  );
  await edit.focus();
  await expect(edit).toBeFocused();
  await edit.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("users-icon-actions.png") });
  await edit.click();
  await expect(
    page.getByRole("heading", { name: "Manage account" }),
  ).toBeVisible();
  await expect(
    page.locator(".account-form svg, .staff-password-reset svg"),
  ).toHaveCount(0);
  await page.goto(`/superadmin/departments`);
  const department = page.getByRole("row").filter({ hasText: "MHO draft" });
  await expect(
    department.getByRole("link", { name: "Edit department", exact: true }),
  ).toHaveAttribute("href", `/superadmin/departments/${mho}`);
  await expect(
    department.getByRole("link", {
      name: "Edit page, head and images",
      exact: true,
    }),
  ).toHaveAttribute(
    "href",
    `/admin/content/departments/edit/${mho}?office=${mho}`,
  );
  await department.locator(".admin-actions-cell").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("department-icon-actions.png"),
  });
});

test("document View and Edit remain distinct while viewers only receive read actions", async ({
  page,
}, info) => {
  await signIn(page, "vmo");
  for (const collection of ["ordinances", "resolutions", "documents"]) {
    await page.goto(legislative(collection));
    await auditActionTables(page);
    const actions = page
      .locator("main table tbody tr")
      .first()
      .locator("td")
      .last();
    const viewHref = await actions
      .getByRole("link", { name: "View", exact: true })
      .getAttribute("href");
    const editHref = await actions
      .getByRole("link", { name: "Edit", exact: true })
      .getAttribute("href");
    expect(viewHref).toContain(`/${collection}/view/`);
    expect(editHref).toContain(`/${collection}/edit/`);
    expect(viewHref).not.toBe(editHref);
  }
  await page
    .locator("main table tbody tr")
    .first()
    .locator("td")
    .last()
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("document-view-edit-icons.png"),
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, "actions-viewer");
  for (const route of [
    legislative("officials"),
    legislative("sessions"),
    legislative("committees"),
    legislative("documents"),
    "/admin/barangays",
    "/admin/transparency",
    "/admin/transparency/modules",
  ]) {
    await page.goto(route);
    await auditActionTables(page, true);
    await expect(
      page
        .locator(".admin-actions-cell")
        .getByRole("link", { name: /^Edit(?: |$)/ }),
    ).toHaveCount(0);
    await expect(page.locator("main table summary")).toHaveCount(0);
  }
  await page.goto(legislative("documents"));
  const view = page.getByRole("link", { name: "View", exact: true }).first();
  const viewHref = await view.getAttribute("href");
  await view.click();
  await expect(page).toHaveURL(new RegExp(`/admin/content/documents/view/`));
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await page.goto(viewHref!.replace("/view/", "/edit/"));
  await expect(
    page.getByRole("button", { name: /Save (document|record)/ }),
  ).toHaveCount(0);
  await page.goto("/superadmin/users");
  await expect(page).toHaveURL(/\/admin$/);
});

test("Transparency icon deletion only opens the existing confirmation", async ({
  page,
}, info) => {
  await signIn(page, "superadmin");
  for (const [route, title] of [
    ["/admin/transparency/modules", "Bidding documents"],
    ["/admin/transparency", "CMS quarterly report"],
  ]) {
    await page.goto(route);
    await auditActionTables(page);
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: title, exact: true }) });
    await expect(
      row.getByRole("link", { name: `Edit ${title}`, exact: true }),
    ).toHaveCount(1);
    const summary = row.locator("summary");
    await expect(summary).toHaveAttribute("aria-label", `Delete ${title}`);
    await expect(summary).toHaveAttribute("title", `Delete ${title}`);
    const before = await page.locator("main table tbody tr").count();
    await expect(row.getByLabel("Confirm deletion")).toBeHidden();
    await summary.focus();
    await summary.click();
    await expect(row.getByLabel("Confirm deletion")).toBeVisible();
    await expect(row.getByLabel("Confirm deletion")).not.toBeChecked();
    await expect(
      row.getByRole("button", { name: "Delete", exact: true }),
    ).toBeVisible();
    const confirmation = row.locator(".transparency-delete form");
    await expect
      .poll(
        async () =>
          confirmation.evaluate((form) => {
            const wrapper = form.closest(".admin-table-wrap")!;
            const bounds = wrapper.getBoundingClientRect();
            const formBounds = form.getBoundingClientRect();
            const left = Math.max(0, bounds.left + wrapper.clientLeft);
            const right = Math.min(
              innerWidth,
              bounds.left + wrapper.clientLeft + wrapper.clientWidth,
            );
            return {
              leftVisible: formBounds.left >= left - 1,
              rightVisible: formBounds.right <= right + 1,
            };
          }),
        {
          message:
            "Expanded confirmation must fit inside its visible table scroller",
        },
      )
      .toEqual({ leftVisible: true, rightVisible: true });
    await expect(summary).toBeFocused();
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(
        route.endsWith("modules")
          ? "module-delete-confirmation.png"
          : "report-delete-confirmation.png",
      ),
    });
    await summary.click();
    await expect(row.getByLabel("Confirm deletion")).toBeHidden();
    await expect(page.locator("main table tbody tr")).toHaveCount(before);
    if (route === "/admin/transparency")
      await expect(row.locator("td").first().getByRole("link")).toHaveCount(0);
  }
});
