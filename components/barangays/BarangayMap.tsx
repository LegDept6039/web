"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LatLngBounds, Map as LeafletMap } from "leaflet";
import {
  barangayBoundaryCenter,
  findBarangayBoundary,
  parseBarangayBoundaries,
} from "@/lib/barangays/boundaries";
import "leaflet/dist/leaflet.css";
import styles from "./BarangayMap.module.css";

type MapPhase = "loading" | "ready" | "missing" | "error";
type MapState = {
  slug: string;
  phase: MapPhase;
  tileError: boolean;
  googleMapsUrl?: string;
};

export function BarangayMap({ name, slug }: { name: string; slug: string }) {
  const titleId = useId();
  const captionId = useId();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const boundsRef = useRef<LatLngBounds | null>(null);
  const [state, setState] = useState<MapState>({
    slug,
    phase: "loading",
    tileError: false,
  });
  const phase = state.slug === slug ? state.phase : "loading";
  const tileError = state.slug === slug && state.tileError;
  const googleMapsUrl = state.slug === slug ? state.googleMapsUrl : undefined;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let map: LeafletMap | undefined;
    let resizeObserver: ResizeObserver | undefined;

    async function loadMap() {
      try {
        const [leaflet, response] = await Promise.all([
          import("leaflet"),
          fetch("/maps/pinamungajan-barangays.geojson", {
            signal: controller.signal,
          }),
        ]);
        if (!response.ok) throw new Error("Boundary data is unavailable");
        const boundaries = parseBarangayBoundaries(await response.json());
        if (!boundaries) throw new Error("Boundary data is invalid");
        if (cancelled || !container.current) return;
        const selected = findBarangayBoundary(boundaries, slug, name);
        if (!selected) {
          setState({ slug, phase: "missing", tileError: false });
          return;
        }

        const L = typeof leaflet.map === "function" ? leaflet : leaflet.default;
        map = L.map(container.current, {
          scrollWheelZoom: false,
          minZoom: 8,
          maxZoom: 19,
          zoomControl: true,
        });
        mapRef.current = map;

        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        );
        tiles.on("tileerror", () => {
          if (!cancelled) {
            setState((current) => ({ ...current, slug, tileError: true }));
          }
        });
        tiles.addTo(map);

        L.geoJSON(boundaries, {
          filter: (feature) =>
            feature.properties?.nameKey !== selected.properties.nameKey,
          interactive: false,
          style: {
            className: "barangay-context-boundary",
            color: "#647b8d",
            weight: 1,
            opacity: 0.6,
            fillColor: "#b2bfca",
            fillOpacity: 0.05,
          },
        }).addTo(map);
        const highlighted = L.geoJSON(selected, {
          interactive: false,
          style: {
            className: "barangay-selected-boundary",
            color: "#23568b",
            weight: 3,
            opacity: 1,
            fillColor: "#4585bc",
            fillOpacity: 0.2,
          },
        }).addTo(map);
        const bounds = highlighted.getBounds();
        if (!bounds.isValid()) throw new Error("Boundary bounds are invalid");
        boundsRef.current = bounds;
        map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 15,
          animate: false,
        });
        const [longitude, latitude] = barangayBoundaryCenter(selected);
        const googleMaps = new URL("https://www.google.com/maps/@");
        googleMaps.search = new URLSearchParams({
          api: "1",
          map_action: "map",
          center: `${latitude.toFixed(7)},${longitude.toFixed(7)}`,
          zoom: String(map.getZoom()),
        }).toString();
        resizeObserver = new ResizeObserver(() => {
          if (!cancelled && map) {
            map.invalidateSize({ pan: false });
            map.fitBounds(bounds, {
              padding: [20, 20],
              maxZoom: 15,
              animate: false,
            });
          }
        });
        resizeObserver.observe(container.current);
        setState((current) => ({
          slug,
          phase: "ready",
          tileError: current.slug === slug && current.tileError,
          googleMapsUrl: googleMaps.href,
        }));
      } catch {
        if (cancelled) return;
        resizeObserver?.disconnect();
        map?.remove();
        map = undefined;
        mapRef.current = null;
        boundsRef.current = null;
        setState({ slug, phase: "error", tileError: false });
      }
    }

    void loadMap();
    return () => {
      cancelled = true;
      controller.abort();
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      boundsRef.current = null;
    };
  }, [name, slug]);

  function resetView() {
    if (mapRef.current && boundsRef.current) {
      mapRef.current.fitBounds(boundsRef.current, {
        padding: [20, 20],
        maxZoom: 15,
        animate: false,
      });
    }
  }

  const notice =
    phase === "loading"
      ? "Loading barangay boundary…"
      : phase === "missing"
        ? "A matching boundary is not available for this barangay."
        : phase === "error"
          ? "The barangay map could not be loaded. Please try again later."
          : tileError
            ? "Street map tiles are unavailable. The barangay boundary is still shown."
            : `${name} boundary highlighted.`;

  return (
    <figure
      className={`barangay-map ${styles.card}`}
      aria-label={`${name} barangay boundary map`}
      data-barangay={slug}
      data-map-state={phase}
    >
      <div className={styles.header}>
        <div>
          <h2 id={titleId}>Barangay map</h2>
          <p>{name}</p>
        </div>
        <button
          type="button"
          className={styles.reset}
          onClick={resetView}
          disabled={phase !== "ready"}
          aria-label="Reset map view"
        >
          Reset view
        </button>
      </div>
      <div className={styles.viewport} aria-busy={phase === "loading"}>
        <div
          ref={container}
          className={styles.map}
          role="region"
          aria-label={`Interactive map of ${name}`}
          aria-describedby={captionId}
        />
        {phase !== "ready" && (
          <div className={styles.placeholder} aria-hidden="true">
            {phase === "loading" ? "Loading map…" : "Map unavailable"}
          </div>
        )}
      </div>
      <figcaption id={captionId} className={styles.caption}>
        <p role="status" aria-live="polite">
          {notice}
        </p>
        <p>Drag the map or use + and - to explore.</p>
      </figcaption>
      {phase === "ready" && googleMapsUrl && (
        <div className={styles.actions}>
          <a
            className={styles.googleMaps}
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Google Maps (opens in a new tab)"
          >
            Open Google Maps
          </a>
        </div>
      )}
    </figure>
  );
}
