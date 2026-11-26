import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import proj4 from "proj4";
import {
  barangayBoundaryBounds,
  barangayBoundaryCenter,
  findBarangayBoundary,
  normalizeBarangayName,
  parseBarangayBoundaries,
  type BarangayBoundaryCollection,
} from "../../lib/barangays/boundaries";

const originalBytes = readFileSync(
  "data/gis/pinamungajan-barangays.utm51n.geojson",
);
const original = JSON.parse(
  originalBytes.toString("utf8").replace(/^\uFEFF/, ""),
) as {
  crs: { properties: { name: string } };
  features: {
    properties: { Name: string; Area: number };
    geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
  }[];
};
const rawAsset: unknown = JSON.parse(
  readFileSync("public/maps/pinamungajan-barangays.geojson", "utf8"),
);
const collection = parseBarangayBoundaries(rawAsset);
if (!collection) throw new Error("The checked-in boundary asset is invalid.");
const boundaries: BarangayBoundaryCollection = collection;
const signedArea = (ring: number[][]) =>
  ring.slice(1).reduce((sum, point, index) => {
    const previous = ring[index];
    return sum + previous[0] * point[1] - point[0] * previous[1];
  }, 0) / 2;

test("preserves the exact QGIS source and all reference features without seeding new barangays", () => {
  expect(createHash("sha256").update(originalBytes).digest("hex")).toBe(
    "84cb4374ab194732aaf622d3e72f96683a9d7bf311ef16face29e9ecc9d72759",
  );
  expect(original.crs.properties.name).toBe("urn:ogc:def:crs:EPSG::32651");
  expect(boundaries.features).toHaveLength(27);
  expect(boundaries.features.map((feature) => feature.properties.name)).toEqual(
    original.features.map((feature) => feature.properties.Name),
  );
  for (const feature of boundaries.features)
    expect(Object.keys(feature.properties).sort()).toEqual(["name", "nameKey"]);
  expect(rawAsset).not.toHaveProperty("crs");
});

test("matches each of the 26 existing barangays uniquely, including QGIS spelling variants", () => {
  const seedSql = readFileSync(
    "supabase/migrations/202611230030_barangay_sk_seed.sql",
    "utf8",
  );
  const registered = Array.from(
    seedSql.matchAll(/ \('([^']+)','([^']+)',\d+\)/g),
    ([, name, slug]) => ({ name, slug }),
  );
  expect(registered).toHaveLength(26);
  const matches = registered.map(({ name, slug }) => {
    const feature = findBarangayBoundary(boundaries, slug, name);
    expect(feature, `Missing geography for ${name}`).toBeDefined();
    return feature!.properties.nameKey;
  });
  expect(new Set(matches).size).toBe(26);
  expect(
    boundaries.features
      .filter((feature) => !matches.includes(feature.properties.nameKey))
      .map((feature) => feature.properties.name),
  ).toEqual(["CAMPALABO"]);
  expect(
    findBarangayBoundary(boundaries, "buhingtubig", "Buhingtubig")?.properties
      .name,
  ).toBe("BUHING-TUBIG");
  expect(
    findBarangayBoundary(boundaries, "guimbawian", "Guimbawian")?.properties
      .name,
  ).toBe("GUIMBAWI-AN");
  expect(
    findBarangayBoundary(boundaries, "custom-page", "Lut-od")?.properties.name,
  ).toBe("LUT-OD");
  expect(
    findBarangayBoundary(boundaries, "unmapped", "Unmapped"),
  ).toBeUndefined();
});

test("retains every source vertex, closed rings and RFC 7946 winding in geographic coordinates", () => {
  let positions = 0;
  for (const source of original.features) {
    const feature = findBarangayBoundary(
      boundaries,
      "",
      source.properties.Name,
    )!;
    expect(feature.geometry.coordinates).toHaveLength(
      source.geometry.coordinates.length,
    );
    source.geometry.coordinates.forEach((sourcePolygon, polygonIndex) => {
      const polygon = feature.geometry.coordinates[polygonIndex];
      expect(polygon).toHaveLength(sourcePolygon.length);
      sourcePolygon.forEach((sourceRing, ringIndex) => {
        const ring = polygon[ringIndex];
        expect(ring).toHaveLength(sourceRing.length);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        expect(signedArea(ring) > 0).toBe(ringIndex === 0);
        const reverse = signedArea(sourceRing) > 0 !== (ringIndex === 0);
        ring.forEach((point, index) => {
          positions++;
          expect(point.every(Number.isFinite)).toBe(true);
          // Independent geographic plausibility check, not just +/-180/90.
          expect(point[0]).toBeGreaterThan(123.5);
          expect(point[0]).toBeLessThan(123.8);
          expect(point[1]).toBeGreaterThan(10.1);
          expect(point[1]).toBeLessThan(10.4);
          const restored = proj4(
            "EPSG:4326",
            "+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs",
            point,
          );
          const sourcePoint =
            sourceRing[reverse ? sourceRing.length - 1 - index : index];
          expect(
            Math.hypot(
              restored[0] - sourcePoint[0],
              restored[1] - sourcePoint[1],
            ),
          ).toBeLessThan(0.001);
        });
      });
    });
  }
  expect(positions).toBe(671);
});

test("agrees with independent QGIS PROJ 9.4 longitude/latitude control points", () => {
  // cs2cs -f %.12f EPSG:32651 OGC:CRS84, bundled with QGIS 3.34.11.
  const controlPoints = [
    ["TUPAS", 123.63132025434, 10.209736629904],
    ["GUIMBAWI-AN", 123.637311491168, 10.243887324271],
    ["BUHING-TUBIG", 123.627460869896, 10.28419277188],
    ["CAMPALABO", 123.568550741617, 10.306571517424],
    ["TUTAY", 123.570553697206, 10.259208703333],
  ] as const;
  for (const [name, longitude, latitude] of controlPoints) {
    const feature = findBarangayBoundary(boundaries, "", name)!;
    const [actualLongitude, actualLatitude] =
      feature.geometry.coordinates[0][0][0];
    expect(Math.abs(actualLongitude - longitude)).toBeLessThan(0.000000001);
    expect(Math.abs(actualLatitude - latitude)).toBeLessThan(0.000000001);
  }
});

test("returns bounds containing every vertex and a bounded map center without inventing a hall location", () => {
  for (const feature of boundaries.features) {
    const [west, south, east, north] = barangayBoundaryBounds(feature);
    const [longitude, latitude] = barangayBoundaryCenter(feature);
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(longitude).toBeGreaterThan(west);
    expect(longitude).toBeLessThan(east);
    expect(latitude).toBeGreaterThan(south);
    expect(latitude).toBeLessThan(north);
    for (const point of feature.geometry.coordinates.flat(2)) {
      expect(point[0]).toBeGreaterThanOrEqual(west);
      expect(point[0]).toBeLessThanOrEqual(east);
      expect(point[1]).toBeGreaterThanOrEqual(south);
      expect(point[1]).toBeLessThanOrEqual(north);
    }
  }
});

test("rejects invalid, projected, nonfinite, open or ambiguously named map assets", () => {
  expect(normalizeBarangayName("  GUIMBAWI-AN ")).toBe("guimbawian");
  for (const invalid of [
    null,
    {},
    [],
    { type: "FeatureCollection", features: [] },
  ])
    expect(parseBarangayBoundaries(invalid)).toBeNull();
  for (const invalidCoordinate of [NaN, Infinity, 561587.8, -181]) {
    const invalid = structuredClone(boundaries);
    invalid.features[0].geometry.coordinates[0][0][1][0] = invalidCoordinate;
    expect(parseBarangayBoundaries(invalid)).toBeNull();
  }
  const openRing = structuredClone(boundaries);
  openRing.features[0].geometry.coordinates[0][0].pop();
  expect(parseBarangayBoundaries(openRing)).toBeNull();
  const degenerate = structuredClone(boundaries);
  degenerate.features[0].geometry.coordinates[0][0] = [
    [123, 10],
    [123.1, 10],
    [123.2, 10],
    [123, 10],
  ];
  expect(parseBarangayBoundaries(degenerate)).toBeNull();
  const duplicate = structuredClone(boundaries);
  duplicate.features.push(duplicate.features[0]);
  expect(parseBarangayBoundaries(duplicate)).toBeNull();
  const wrongKey = structuredClone(boundaries);
  wrongKey.features[0].properties.nameKey = "anotherbarangay";
  expect(parseBarangayBoundaries(wrongKey)).toBeNull();
});
