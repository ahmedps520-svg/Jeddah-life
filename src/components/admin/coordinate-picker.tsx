"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "@/components/i18n/i18n-provider";
import { getMaplibre } from "@/lib/map/maplibre";
import { JEDDAH_CENTER, loadMapStyle } from "@/lib/map/style";
import { inJeddah, JEDDAH_LAT, JEDDAH_LNG } from "@/lib/admin/validate";

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Small map for admin forms. Shows the current coordinates; clicking the map
 * or dragging the pin sets new ones. The latitude/longitude inputs next to it
 * remain the accessible, keyboard-friendly way to enter a location.
 */
export function CoordinatePicker({
  lat,
  lng,
  onPick,
  className = "h-72",
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pick = useRef(onPick);
  const [failed, setFailed] = useState(false);
  const valid = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && inJeddah(lat, lng);
  const start = useRef(valid ? ([lng!, lat!] as [number, number]) : null);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const maplibregl = await getMaplibre();
        const style = await loadMapStyle(locale);
        if (cancelled || !el.current) return;
        const m = new maplibregl.Map({
          container: el.current,
          style,
          center: start.current ?? JEDDAH_CENTER,
          zoom: start.current ? 15 : 10.5,
          maxBounds: [
            [JEDDAH_LNG[0] - 0.1, JEDDAH_LAT[0] - 0.1],
            [JEDDAH_LNG[1] + 0.1, JEDDAH_LAT[1] + 0.1],
          ],
          attributionControl: { compact: true },
        });
        map.current = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), locale === "ar" ? "top-left" : "top-right");
        m.getCanvas().style.cursor = "crosshair";
        const mk = new maplibregl.Marker({ color: "#127c83", draggable: true });
        marker.current = mk;
        if (start.current) mk.setLngLat(start.current).addTo(m);
        mk.on("dragend", () => {
          const p = mk.getLngLat();
          pick.current(round(p.lat), round(p.lng));
        });
        m.on("click", (e) => {
          const { lat: la, lng: ln } = e.lngLat;
          if (!inJeddah(la, ln)) return;
          mk.setLngLat([ln, la]).addTo(m);
          pick.current(round(la), round(ln));
        });
        m.on("error", (e) => {
          if (!m.isStyleLoaded() && e.error) setFailed(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [locale]);

  // Follow coordinates typed into the inputs.
  useEffect(() => {
    const m = map.current;
    const mk = marker.current;
    if (!m || !mk) return;
    if (valid) {
      const cur = mk.getLngLat?.();
      if (!cur || Math.abs(cur.lat - lat!) > 1e-7 || Math.abs(cur.lng - lng!) > 1e-7) {
        mk.setLngLat([lng!, lat!]).addTo(m);
        m.easeTo({ center: [lng!, lat!], zoom: Math.max(m.getZoom(), 14), duration: 400 });
      }
    } else {
      mk.remove();
    }
  }, [lat, lng, valid]);

  return (
    <div>
      <div className={`relative overflow-hidden rounded-2xl bg-sand-200 ring-1 ring-sand-300 ${className}`} role="region" aria-label={t.admin.common.mapLabel}>
        <div ref={el} style={{ position: "absolute", inset: 0 }} />
        {failed && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-500">{t.admin.common.mapUnavailable}</div>}
      </div>
      {!failed && <p className="mt-1.5 text-xs text-ink-500">{t.admin.common.mapHint}</p>}
    </div>
  );
}
