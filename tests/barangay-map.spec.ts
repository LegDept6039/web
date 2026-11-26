import { test, expect, type Page } from "@playwright/test";
import type { BarangayBoundaryCollection } from "../lib/barangays/boundaries";

// Public-only tests use the supplied boundary asset and the existing Anislag /
// Anopog records. Basemap tiles are deterministic test artwork, not live OSM.
const tileURL = /https:\/\/(?:[abc]\.)?tile\.openstreetmap\.org\//;
const boundaryURL = "**/maps/pinamungajan-barangays.geojson";
const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf2f4"/><path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256" stroke="#d8e1e7"/><text x="128" y="240" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#738797">Test basemap tile</text></svg>`;

function map(page: Page, name = "Anislag") {
  return page.getByRole("figure", {
    name: `${name} barangay boundary map`,
    exact: true,
  });
}

async function ready(page: Page, name = "Anislag", expectBasemap = true) {
  const figure = map(page, name);
  await expect(figure).toHaveAttribute("data-map-state", "ready");
  await expect(
    figure.getByRole("region", {
      name: `Interactive map of ${name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(figure.locator(".barangay-selected-boundary")).toHaveCount(1);
  await expect(figure.locator(".barangay-selected-boundary")).toBeVisible();
  if (expectBasemap)
    await expect(figure).toContainText(`${name} boundary highlighted.`);
  return figure;
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

async function googleMapLink(
  page: Page,
  name: string,
  boundaries: BarangayBoundaryCollection,
) {
  const link = map(page, name).getByRole("link", {
    name: "Open Google Maps (opens in a new tab)",
    exact: true,
  });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
  await expect(link).toHaveAttribute("rel", /\bnoreferrer\b/);
  const href = await link.getAttribute("href");
  const url = new URL(href!);
  expect(url.origin).toBe("https://www.google.com");
  expect(url.pathname).toBe("/maps/@");
  expect(url.searchParams.get("api")).toBe("1");
  expect(url.searchParams.get("map_action")).toBe("map");
  expect(url.searchParams.get("center")).toMatch(
    /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/,
  );
  const [latitude, longitude] = url.searchParams
    .get("center")!
    .split(",")
    .map(Number);
  expect(latitude).toBeGreaterThan(10);
  expect(latitude).toBeLessThan(11);
  expect(longitude).toBeGreaterThan(123);
  expect(longitude).toBeLessThan(124);
  const feature = boundaries.features.find(
    (item) => item.properties.nameKey === name.toLowerCase(),
  );
  expect(feature).toBeDefined();
  const positions = feature!.geometry.coordinates.flat(2);
  const expectedLongitude =
    (Math.min(...positions.map((point) => point[0])) +
      Math.max(...positions.map((point) => point[0]))) /
    2;
  const expectedLatitude =
    (Math.min(...positions.map((point) => point[1])) +
      Math.max(...positions.map((point) => point[1]))) /
    2;
  expect(latitude).toBeCloseTo(expectedLatitude, 6);
  expect(longitude).toBeCloseTo(expectedLongitude, 6);
  const zoom = Number(url.searchParams.get("zoom"));
  expect(Number.isInteger(zoom)).toBe(true);
  expect(zoom).toBeGreaterThanOrEqual(8);
  expect(zoom).toBeLessThanOrEqual(15);
  return href;
}

test("matching boundaries fit beside the body, support keyboard zoom, and change on public navigation", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(tileURL, (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: tile }),
  );
  const source = page.waitForResponse(
    (response) =>
      response.url().endsWith("/maps/pinamungajan-barangays.geojson") &&
      response.ok(),
  );
  await page.goto("/barangays/anislag");
  const boundaries = (await (
    await source
  ).json()) as BarangayBoundaryCollection;
  const figure = await ready(page);
  const initialGoogleMapsUrl = await googleMapLink(page, "Anislag", boundaries);
  await expect(figure).toHaveAttribute("data-barangay", "anislag");
  await expect(
    figure.getByRole("link", { name: "OpenStreetMap", exact: true }),
  ).toBeVisible();
  const selected = figure.locator(".barangay-selected-boundary");
  const region = figure.getByRole("region", {
    name: "Interactive map of Anislag",
    exact: true,
  });
  const pathBox = await selected.boundingBox();
  const mapBox = await region.boundingBox();
  expect(pathBox).not.toBeNull();
  expect(mapBox).not.toBeNull();
  expect(pathBox!.width).toBeGreaterThan(mapBox!.width * 0.15);
  expect(pathBox!.height).toBeGreaterThan(mapBox!.height * 0.15);
  expect(pathBox!.width).toBeLessThanOrEqual(mapBox!.width);
  expect(pathBox!.height).toBeLessThanOrEqual(mapBox!.height);
  const fittedPath = await selected.getAttribute("d");
  const zoomIn = figure.getByRole("button", { name: "Zoom in", exact: true });
  await zoomIn.focus();
  await page.keyboard.press("Enter");
  await expect(selected).not.toHaveAttribute("d", fittedPath!);
  await figure
    .getByRole("button", { name: "Reset map view", exact: true })
    .click();
  await expect(selected).toHaveAttribute("d", fittedPath!);
  const captain = page.locator(".barangay-leadership");
  const body = page.locator(".barangay-body");
  const news = page.getByRole("region", { name: "Barangay news", exact: true });
  await expect(captain).toContainText("Captain Anislag");
  await expect(body).toHaveText("Information about Anislag.");
  expect(
    await captain.evaluate((element) =>
      Boolean(
        element.compareDocumentPosition(
          document.querySelector(".barangay-body")!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
  expect(
    await figure.evaluate((element) =>
      Boolean(
        element.compareDocumentPosition(
          document.querySelector("#barangay-news-title")!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
  await expect(
    news.getByRole("heading", {
      name: "Anislag community update",
      exact: true,
    }),
  ).toBeVisible();
  await expect(news).not.toContainText("Anopog community update");
  const bodyBox = await body.boundingBox();
  const figureBox = await figure.boundingBox();
  const photoBox = await page
    .locator(".barangay-detail .barangay-image")
    .boundingBox();
  const captainBox = await captain.boundingBox();
  if (info.project.name === "desktop") {
    expect(figureBox!.x).toBeGreaterThanOrEqual(
      bodyBox!.x + bodyBox!.width - 2,
    );
    expect(Math.abs(figureBox!.y - photoBox!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(captainBox!.y - photoBox!.y)).toBeLessThanOrEqual(2);
  } else {
    expect(figureBox!.y).toBeGreaterThanOrEqual(
      bodyBox!.y + bodyBox!.height - 2,
    );
    expect(captainBox!.y).toBeGreaterThanOrEqual(
      photoBox!.y + photoBox!.height - 2,
    );
  }
  await noOverflow(page);
  await page.locator(".barangay-detail").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({
    path: info.outputPath("barangay-body-map.png"),
    fullPage: true,
  });

  // Follow Next links so the map must clean up and select the next boundary.
  await page.getByRole("link", { name: "All barangays", exact: true }).click();
  await expect(page).toHaveURL(/\/barangays$/);
  await page
    .getByRole("heading", { name: "Anopog", exact: true })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(/\/barangays\/anopog$/);
  const nextMap = await ready(page, "Anopog");
  const nextGoogleMapsUrl = await googleMapLink(page, "Anopog", boundaries);
  expect(nextGoogleMapsUrl).not.toBe(initialGoogleMapsUrl);
  await expect(nextMap).toHaveAttribute("data-barangay", "anopog");
  await expect(
    nextMap.locator(".barangay-selected-boundary"),
  ).not.toHaveAttribute("d", fittedPath!);
  await expect(page.locator(".barangay-leadership")).toContainText(
    "Captain Anopog",
  );
  await expect(page.locator(".barangay-body")).toHaveText(
    "Information about Anopog.",
  );
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("tile failure keeps the boundary visible and a missing boundary asset leaves the profile usable", async ({
  page,
}, info) => {
  await page.route(tileURL, (route) => route.abort("failed"));
  const source = page.waitForResponse(
    (response) =>
      response.url().endsWith("/maps/pinamungajan-barangays.geojson") &&
      response.ok(),
  );
  await page.goto("/barangays/anislag");
  const boundaries = (await (
    await source
  ).json()) as BarangayBoundaryCollection;
  const figure = await ready(page, "Anislag", false);
  await expect(figure).toContainText(
    "Street map tiles are unavailable. The barangay boundary is still shown.",
  );
  await expect(figure.locator(".barangay-selected-boundary")).toBeVisible();
  await expect(
    figure.getByRole("button", { name: "Reset map view", exact: true }),
  ).toBeEnabled();
  await noOverflow(page);
  await figure.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("boundary-with-unavailable-tiles.png"),
    fullPage: true,
  });

  await page.route(boundaryURL, (route) =>
    route.fulfill({
      status: 404,
      contentType: "text/plain",
      body: "Not found",
    }),
  );
  await page.reload();
  await expect(map(page)).toContainText(
    "The barangay map could not be loaded. Please try again later.",
  );
  await expect(map(page).locator(".barangay-selected-boundary")).toHaveCount(0);
  await expect(page.locator(".barangay-leadership")).toContainText(
    "Captain Anislag",
  );
  await expect(page.locator(".barangay-body")).toHaveText(
    "Information about Anislag.",
  );
  await expect(
    page
      .getByRole("region", { name: "Barangay news", exact: true })
      .getByRole("heading", { name: "Anislag community update", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("unavailable-map-profile.png"),
    fullPage: true,
  });

  // A valid file that lacks this name must not fall back to another polygon.
  await page.unroute(boundaryURL);
  await page.route(boundaryURL, (route) =>
    route.fulfill({
      contentType: "application/geo+json",
      body: JSON.stringify({
        ...boundaries,
        features: boundaries.features.filter(
          (feature) => feature.properties.nameKey !== "anislag",
        ),
      }),
    }),
  );
  await page.reload();
  await expect(map(page)).toHaveAttribute("data-map-state", "missing");
  await expect(map(page)).toContainText(
    "A matching boundary is not available for this barangay.",
  );
  await expect(map(page).locator(".barangay-selected-boundary")).toHaveCount(0);
  await expect(
    map(page).getByRole("button", { name: "Reset map view", exact: true }),
  ).toBeDisabled();
  await noOverflow(page);
});
