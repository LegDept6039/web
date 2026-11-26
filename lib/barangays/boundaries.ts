import type { Feature, FeatureCollection, MultiPolygon } from "geojson";

export type BarangayBoundary = Feature<
  MultiPolygon,
  { name: string; nameKey: string }
>;
export type BarangayBoundaryCollection = FeatureCollection<
  MultiPolygon,
  { name: string; nameKey: string }
>;

export function normalizeBarangayName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validRing(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 4) return false;
  if (
    !value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(
          (coordinate) =>
            typeof coordinate === "number" && Number.isFinite(coordinate),
        ) &&
        Math.abs(point[0]) <= 180 &&
        Math.abs(point[1]) <= 90,
    )
  )
    return false;
  const first = value[0];
  const last = value[value.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return false;
  // Avoid catastrophic cancellation from absolute longitudes in small rings.
  const twiceArea = value.slice(1).reduce((sum, point, index) => {
    const previous = value[index];
    return (
      sum +
      (previous[0] - first[0]) * (point[1] - first[1]) -
      (point[0] - first[0]) * (previous[1] - first[1])
    );
  }, 0);
  return twiceArea !== 0;
}

/** Reject corrupt map assets rather than inventing a center or boundary. */
export function parseBarangayBoundaries(
  value: unknown,
): BarangayBoundaryCollection | null {
  if (
    !record(value) ||
    value.type !== "FeatureCollection" ||
    !Array.isArray(value.features) ||
    !value.features.length ||
    value.features.length > 100
  )
    return null;
  const names = new Set<string>();
  let positions = 0;
  for (const feature of value.features) {
    if (
      !record(feature) ||
      feature.type !== "Feature" ||
      !record(feature.properties) ||
      typeof feature.properties.name !== "string" ||
      !feature.properties.name.trim() ||
      feature.properties.name.length > 160 ||
      typeof feature.properties.nameKey !== "string" ||
      feature.properties.nameKey !==
        normalizeBarangayName(feature.properties.name) ||
      !feature.properties.nameKey ||
      names.has(feature.properties.nameKey) ||
      !record(feature.geometry) ||
      feature.geometry.type !== "MultiPolygon" ||
      !Array.isArray(feature.geometry.coordinates) ||
      !feature.geometry.coordinates.length
    )
      return null;
    names.add(feature.properties.nameKey);
    for (const polygon of feature.geometry.coordinates) {
      if (!Array.isArray(polygon) || !polygon.length) return null;
      for (const ring of polygon) {
        if (!validRing(ring)) return null;
        positions += ring.length;
        if (positions > 100000) return null;
      }
    }
  }
  return value as unknown as BarangayBoundaryCollection;
}

/** Existing database slugs/names identify geography; no new CMS rows are made. */
export function findBarangayBoundary(
  collection: BarangayBoundaryCollection,
  slug: string,
  name: string,
): BarangayBoundary | undefined {
  const slugKey = normalizeBarangayName(slug);
  const nameKey = normalizeBarangayName(name);
  return (
    collection.features.find(
      (feature) => feature.properties.nameKey === slugKey,
    ) ??
    collection.features.find(
      (feature) => feature.properties.nameKey === nameKey,
    )
  );
}

export function barangayBoundaryBounds(
  feature: BarangayBoundary,
): [west: number, south: number, east: number, north: number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const polygon of feature.geometry.coordinates)
    for (const ring of polygon)
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
  return [west, south, east, north];
}

/** Bounds midpoint for positioning a map, not an official barangay hall point. */
export function barangayBoundaryCenter(
  feature: BarangayBoundary,
): [longitude: number, latitude: number] {
  const [west, south, east, north] = barangayBoundaryBounds(feature);
  return [(west + east) / 2, (south + north) / 2];
}
