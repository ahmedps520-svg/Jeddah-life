"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "@/components/i18n/i18n-provider";
import { JEDDAH_CENTER, loadMapStyle } from "@/lib/map/style";
import type { GeoPolygon } from "@/lib/db/schema";

export type MiniMarker = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  /** Number shown inside the marker (itinerary order) */
  n?: number;
  label?: string;
  href?: string;
};

/**
 * Small embedded map for detail pages, neighbourhoods, collections and
 * itineraries. Real coordinates only; lines between stops are drawn as
 * straight connectors and labelled as such by the caller.
 */
export function MiniMap({
  markers,
  polygon,
  connect = false,
  interactive = true,
  className = "h-64",
  ariaLabel,
  onMarkerClick,
}: {
  markers: MiniMarker[];
  polygon?: GeoPolygon | null;
  connect?: boolean;
  interactive?: boolean;
  className?: string;
  ariaLabel: string;
  onMarkerClick?: (id: string) => void;
}) {
  const { locale, t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [failed, setFailed] = useState(false);
  const markerKey = markers.map((m) => `${m.id}:${m.lat},${m.lng}:${m.n ?? ""}`).join("|");

  useEffect(() => {
    let cancelled = false;
    const htmlMarkers: { remove: () => void }[] = [];
    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        const style = await loadMapStyle(locale);
        if (cancelled || !el.current) return;
        const m = new maplibregl.Map({
          container: el.current,
          style,
          center: markers[0] ? [markers[0].lng, markers[0].lat] : JEDDAH_CENTER,
          zoom: markers.length === 1 ? 14.5 : 11,
          interactive,
          cooperativeGestures: interactive,
          attributionControl: { compact: true },
        });
        map.current = m;
        if (interactive) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), locale === "ar" ? "top-left" : "top-right");

        m.on("load", () => {
          if (cancelled) return;
          if (polygon) {
            m.addSource("area", { type: "geojson", data: { type: "Feature", properties: {}, geometry: polygon as GeoJSON.Geometry } });
            m.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": "#127c83", "fill-opacity": 0.08 } });
            m.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#127c83", "line-width": 2, "line-dasharray": [2, 1.5] } });
          }
          if (connect && markers.length > 1) {
            m.addSource("route", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: markers.map((x) => [x.lng, x.lat]) } },
            });
            m.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#0b1b2b", "line-width": 2.5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.75 },
            });
          }
          for (const mk of markers) {
            const node = document.createElement("button");
            node.type = "button";
            node.setAttribute("aria-label", mk.label ?? "");
            node.className =
              "grid place-items-center rounded-full border-2 border-white text-[12px] font-bold text-white shadow-[0_2px_8px_rgb(0_0_0/0.35)] transition hover:scale-110";
            node.style.background = mk.color ?? "#127c83";
            node.style.width = node.style.height = mk.n != null ? "28px" : "20px";
            if (mk.n != null) node.textContent = String(mk.n);
            node.addEventListener("click", () => {
              if (onMarkerClick) onMarkerClick(mk.id);
              else if (mk.href) window.location.assign(mk.href);
            });
            htmlMarkers.push(new maplibregl.Marker({ element: node }).setLngLat([mk.lng, mk.lat]).addTo(m));
          }
          const pts = markers.map((x) => [x.lng, x.lat] as [number, number]);
          if (polygon) {
            const coords = (polygon.type === "Polygon" ? [polygon.coordinates] : polygon.coordinates) as number[][][][];
            for (const ring of coords.flat()) for (const c of ring) pts.push([c[0], c[1]]);
          }
          if (pts.length > 1) {
            const lngs = pts.map((p) => p[0]);
            const lats = pts.map((p) => p[1]);
            m.fitBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              { padding: 40, maxZoom: 15.5, duration: 0 },
            );
          }
        });
        m.on("error", (e) => {
          // Tile errors are non-fatal; only a failed style load is.
          if (!m.isStyleLoaded() && e.error) setFailed(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      htmlMarkers.forEach((x) => x.remove());
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey, locale, polygon, connect, interactive]);

  // Keep the route source in sync if markers update without re-creating the map.
  useEffect(() => {
    const src = map.current?.getSource("route") as GeoJSONSource | undefined;
    src?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: markers.map((x) => [x.lng, x.lat]) } });
  }, [markers]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-sand-200 ${className}`} role="region" aria-label={ariaLabel}>
      <div ref={el} className="absolute inset-0" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-500">{t.map.loadError}</div>
      )}
    </div>
  );
}
