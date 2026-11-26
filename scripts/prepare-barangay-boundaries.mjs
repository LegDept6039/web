import { readFile, writeFile } from "node:fs/promises";
import proj4 from "proj4";

// The original QGIS export remains unchanged under data/gis. Convert once at
// authoring time; browsers receive ordinary RFC 7946 longitude/latitude data.
const sourceUrl = new URL(
  "../data/gis/pinamungajan-barangays.utm51n.geojson",
  import.meta.url,
);
const outputUrl = new URL(
  "../public/maps/pinamungajan-barangays.geojson",
  import.meta.url,
);
const source = JSON.parse(
  (await readFile(sourceUrl, "utf8")).replace(/^\uFEFF/, ""),
);
if (
  source.type !== "FeatureCollection" ||
  source.crs?.properties?.name !== "urn:ogc:def:crs:EPSG::32651" ||
  !Array.isArray(source.features)
)
  throw new Error("Expected the original EPSG:32651 QGIS FeatureCollection.");

const sourceProjection = "+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs";
const normalizeName = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const signedArea = (ring) =>
  ring.slice(1).reduce((sum, point, index) => {
    const previous = ring[index];
    return sum + previous[0] * point[1] - point[0] * previous[1];
  }, 0) / 2;
const keys = new Set();
const features = source.features.map((feature) => {
  const name = feature.properties?.Name;
  if (
    feature.type !== "Feature" ||
    typeof name !== "string" ||
    !name.trim() ||
    feature.geometry?.type !== "MultiPolygon" ||
    !Array.isArray(feature.geometry.coordinates) ||
    !feature.geometry.coordinates.length
  )
    throw new Error("Invalid named MultiPolygon in the QGIS source.");
  const nameKey = normalizeName(name);
  if (!nameKey || keys.has(nameKey))
    throw new Error(`Missing or ambiguous boundary name: ${name}`);
  keys.add(nameKey);
  const coordinates = feature.geometry.coordinates.map((polygon) => {
    if (!Array.isArray(polygon) || !polygon.length)
      throw new Error(`Empty polygon: ${name}`);
    return polygon.map((ring, index) => {
      if (
        !Array.isArray(ring) ||
        ring.length < 4 ||
        ring.some(
          (point) =>
            !Array.isArray(point) ||
            point.length !== 2 ||
            !point.every(Number.isFinite),
        ) ||
        ring[0][0] !== ring.at(-1)[0] ||
        ring[0][1] !== ring.at(-1)[1]
      )
        throw new Error(`Invalid or open ring: ${name}`);
      const converted = ring.map((point) =>
        proj4(sourceProjection, "EPSG:4326", point).map((coordinate) =>
          Number(coordinate.toFixed(9)),
        ),
      );
      if (
        converted.some(
          ([longitude, latitude]) =>
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude) ||
            Math.abs(longitude) > 180 ||
            Math.abs(latitude) > 90,
        ) ||
        signedArea(converted) === 0
      )
        throw new Error(`Invalid converted ring: ${name}`);
      // RFC 7946: exterior rings counterclockwise; holes clockwise.
      if (signedArea(converted) > 0 !== (index === 0)) converted.reverse();
      return converted;
    });
  });
  return {
    type: "Feature",
    properties: { name: name.trim(), nameKey },
    geometry: { type: "MultiPolygon", coordinates },
  };
});
await writeFile(
  outputUrl,
  `${JSON.stringify({ type: "FeatureCollection", features })}\n`,
  "utf8",
);
console.log(
  `Prepared ${features.length} barangay reference boundaries in WGS 84.`,
);
