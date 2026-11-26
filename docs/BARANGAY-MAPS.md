# Barangay reference maps

The public barangay detail pages use the QGIS boundary export supplied by the
municipal portal owner on 25 November 2026. Geographic reference data is a
versioned map asset; barangay names, publication, bodies, captains, images and
staff access remain in the existing Supabase barangay records. This feature
creates no database rows and requires no SQL migration.

## Source and conversion

- Unmodified source: `data/gis/pinamungajan-barangays.utm51n.geojson`.
- Source SHA-256: `84cb4374ab194732aaf622d3e72f96683a9d7bf311ef16face29e9ecc9d72759`.
- Declared source CRS: EPSG:32651, WGS 84 / UTM zone 51N, metres.
- Browser asset: `public/maps/pinamungajan-barangays.geojson`, RFC 7946 WGS 84
  longitude/latitude in decimal degrees. Exterior rings are counterclockwise,
  hole rings clockwise. Nine decimal places retain source geometry during
  conversion; this precision is not a statement of survey accuracy.
- Regenerate with `node scripts/prepare-barangay-boundaries.mjs`. The script
  uses the development dependency `proj4`; no projection library is shipped
  to browsers. Keep the original export unchanged for provenance.

The 27 supplied MultiPolygon features contain 671 coordinate positions. Each
currently contains one closed exterior ring and no holes. All 26 registered
barangays match uniquely after ignoring case, spaces and punctuation. In
particular, `BUHING-TUBIG` matches Buhingtubig and `GUIMBAWI-AN` matches
Guimbawian. Slug matching falls back to the current barangay name and never
creates a new CMS record.

The additional `CAMPALABO` feature remains separate reference geometry. It is
not assigned to another barangay or inserted as a 27th barangay record.

The supplied `Area` properties are excluded from the browser asset. They are
not authoritative: Mangoto and Poblacion have equal and opposite differences
of approximately 4.17 hectares between the recorded value and polygon area.
No area figure is displayed or written into the barangay records.

## Validation and limits

The data tests check all 26 matches, the separate Campalabo feature, finite
longitude/latitude coordinates, closed rings, winding, projection round trips,
and independent PROJ 9.4 control points from QGIS 3.34.11/GDAL 3.9.2. The
original planar rings were additionally checked for nonadjacent self
intersections and boundary crossings; none were found. This checks data
integrity, not legal boundary status or field accuracy. The retained source and
conversion metadata identify the geometry without claiming an official survey.

Web GeoJSON coordinate requirements are documented in
[RFC 7946](https://www.rfc-editor.org/rfc/rfc7946). UTM conversion is described
by the [PROJ UTM documentation](https://proj.org/en/stable/operations/projections/utm.html).

## Map display

`BarangayMap` loads Leaflet 1.9.4 on the client and reads the converted asset.
Each published barangay page matches its stable slug first, then its current
name. The selected boundary is blue; surrounding features, including Campalabo,
remain separate grey outlines. No point is presented as a barangay hall.

On wide screens the picture, captain/body column, and map align along the same
top edge. At widths of 1100px or less the map follows the body beside the picture;
at 640px or less the picture, captain/body, and map stack vertically. It includes
zoom and reset controls, keyboard navigation, and visible
OpenStreetMap attribution. Wheel zoom is disabled to preserve page scrolling.
Street tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with ordinary
browser caching; no tiles are bulk downloaded or prefetched. See the
[OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

**Open Google Maps** below the map opens Google's map view at the midpoint of
the matched boundary's longitude/latitude bounds, with the initial fitted zoom.
This point is derived from the supplied geometry and does not identify a
barangay hall. Google Maps opens an area view; the custom QGIS polygon remains
on the portal. The link follows Google's
[Maps URL format](https://developers.google.com/maps/documentation/urls/get-started)
and opens in a new tab. It is omitted when no valid boundary is available.

If street tiles fail, the local boundary remains visible. Missing or invalid
boundary data displays an unavailable message without choosing another barangay.
Browser regressions use deterministic test tiles; live tile availability is a
separate network check.
