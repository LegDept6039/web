import { expect, test, type Page } from "@playwright/test";

const branches = [
  { name: "Market Affairs", slug: "market-affairs", image: "community.svg" },
  { name: "Slaughter House", slug: "slaughter-house", image: "coast.svg" },
  { name: "Waterworks", slug: "waterworks", image: "council.svg" },
];

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("public departments separate branches, link the correct parent and retain branch information", async ({
  page,
}, info) => {
  // CMS cases may have uploaded a Market image in the shared transport fixture.
  for (const pattern of [
    "**/_next/image**",
    "https://fixture.supabase.test/storage/**",
  ])
    await page.route(pattern, (route) =>
      route.fulfill({
        path: "public/images/logos/seal.png",
        contentType: "image/png",
      }),
    );
  await page.goto("/departments");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Municipal departments",
  );
  await expect(
    page.getByRole("heading", { name: "Departments", exact: true }),
  ).toBeVisible();
  const topLevel = page.locator(".department-directory-grid").first();
  const directoryBranches = page.getByRole("region", {
    name: "Branches",
    exact: true,
  });
  expect(
    await directoryBranches.locator(".department-card").count(),
  ).toBeGreaterThanOrEqual(3);
  for (const branch of branches) {
    await expect(
      topLevel.getByRole("heading", { name: branch.name, exact: true }),
    ).toHaveCount(0);
    const card = directoryBranches.locator(".department-card").filter({
      has: page.getByRole("heading", { name: branch.name, exact: true }),
    });
    await expect(
      card.getByRole("link", { name: "View branch", exact: true }),
    ).toHaveAttribute("href", `/departments/${branch.slug}`);
    await expect(card.locator(".department-photo img")).toBeVisible();
    const source = decodeURIComponent(
      (await card.locator("img").getAttribute("src")) || "",
    );
    if (branch.slug === "market-affairs")
      expect(source).not.toContain("/images/logos/seal.png");
    else expect(source).toContain(branch.image);
  }
  await noOverflow(page);
  await directoryBranches.screenshot({
    path: info.outputPath("branch-directory.png"),
  });

  await page.goto("/departments/treasury");
  const treasuryBranches = page.getByRole("region", {
    name: "Branches",
    exact: true,
  });
  expect(
    await treasuryBranches.locator(".info-card").count(),
  ).toBeGreaterThanOrEqual(2);
  await expect(treasuryBranches.locator("img")).toHaveCount(0);
  for (const branch of branches.slice(0, 2))
    await expect(
      treasuryBranches.getByRole("link", {
        name: branch.name,
        exact: true,
      }),
    ).toHaveAttribute("href", `/departments/${branch.slug}`);
  await expect(
    treasuryBranches.getByRole("heading", {
      name: "Waterworks",
      exact: true,
    }),
  ).toHaveCount(0);
  await noOverflow(page);
  await treasuryBranches.screenshot({
    path: info.outputPath("treasury-branches.png"),
  });

  await page.goto("/departments/engineering");
  const engineeringBranches = page.getByRole("region", {
    name: "Branches",
    exact: true,
  });
  await expect(engineeringBranches.locator(".info-card")).toHaveCount(1);
  await expect(
    engineeringBranches.getByRole("link", {
      name: "Waterworks",
      exact: true,
    }),
  ).toHaveAttribute("href", "/departments/waterworks");
  await expect(engineeringBranches.locator("img")).toHaveCount(0);

  await page.goto("/departments/market-affairs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Market Affairs",
  );
  await expect(page.locator(".department-parent-link a")).toHaveText(
    "Treasury",
  );
  await expect(page.locator(".department-parent-link a")).toHaveAttribute(
    "href",
    "/departments/treasury",
  );
  const image = page.locator(".department-branch-image img");
  await expect(image).toBeVisible();
  expect(
    decodeURIComponent((await image.getAttribute("src")) || ""),
  ).not.toContain("/images/logos/seal.png");
  await expect(image).toHaveJSProperty("complete", true);
  expect(
    await image.evaluate(
      (element) => (element as HTMLImageElement).naturalWidth,
    ),
  ).toBeGreaterThan(0);
  await expect(
    page.locator(".department-profile .department-photo"),
  ).toBeVisible();
  for (const name of [
    "About the Branch",
    "Department news",
    "Department programs",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Branches", exact: true }),
  ).toHaveCount(0);
  await noOverflow(page);
  await page.locator(".department-branch-image").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("market-affairs-page.png"),
    fullPage: true,
  });

  // A branch reordered before its parent must not replace top-level previews.
  for (const url of ["/", "/executive"]) {
    await page.goto(url);
    const preview = page.locator(".department-card h2 a");
    expect(await preview.count()).toBeGreaterThan(0);
    for (const branch of branches)
      await expect(preview.filter({ hasText: branch.name })).toHaveCount(0);
    await noOverflow(page);
  }
});
