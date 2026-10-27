"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { GeoJSONSource, Map as MLMap, Marker, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BadgeCheck, List, LocateFixed, Map as MapIcon, Navigation, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation, useToast } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button, buttonClass } from "@/components/ui/button";
import { Pill, Toggle } from "@/components/explore/explore-controls";
import { SaveButton } from "@/components/place/save-button";
import { CoverArt } from "@/components/place/cover-art";
import { useNeighbourhoods } from "@/components/layout/location-picker";
import { getMaplibre } from "@/lib/map/maplibre";
import { JEDDAH_BOUNDS, JEDDAH_CENTER, directionsUrl, loadMapStyle } from "@/lib/map/style";
import { FLAG, type MapPlace } from "@/lib/map/compact";
import { PLACE_CATEGORIES, categoryDef, subcategoryLabel } from "@/lib/taxonomy";
import { haversineKm } from "@/lib/places/estimates";
import { formatDistance, formatNumber, formatSarRange, plural } from "@/lib/i18n/format";
import type { Attr } from "@/lib/search/parse";
import type { GeoPolygon } from "@/lib/db/schema";

export type MapFilters = {
  q: string;
  cat: string | null;
  area: string | null;
  max: number | null;
  free: boolean;
  open: boolean;
  rating: number | null;
  dist: number | null;
  attrs: Attr[];
  hideChains: boolean;
  verified: boolean;
};

const ATTR_FLAG: Partial<Record<Attr, number>> = {
  family: FLAG.family,
  indoor: FLAG.indoor,
  outdoor: FLAG.outdoor,
  groups: FLAG.groups,
  wheelchair: FLAG.wheelchair,
  photo: FLAG.photo,
  late: FLAG.late,
};
const ATTR_KEYS: Attr[] = ["family", "indoor", "outdoor", "groups", "photo", "wheelchair", "late"];
const LIST_LIMIT = 80;

function inCat(p: MapPlace, c: string) {
  if (c === "nightlife") return (p.flags & FLAG.late) !== 0 || p.sec.includes("nightlife");
  if (c === "family") return p.cat === "family" || p.sec.includes("family") || (p.flags & FLAG.family) !== 0;
  return p.cat === c || p.sec.includes(c);
}

function quality(p: MapPlace) {
  return ((p.flags & FLAG.verified) ? 6 : 0) + (p.img ? 4 : 0) + ((p.flags & FLAG.pick) ? 4 : 0) - ((p.flags & FLAG.chain) ? 4 : 0) + (p.rating ?? 0);
}

export function MapExplorer({ initial }: { initial: MapFilters }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { origin, location, requestDevice } = useCityLocation();
  const hoods = useNeighbourhoods();

  const [places, setPlaces] = useState<MapPlace[] | null>(null);
  const [filters, setFilters] = useState<MapFilters>(initial);
  const [draft, setDraft] = useState<MapFilters>(initial);
  const [query, setQuery] = useState(initial.q);
  const [smartResult, setSmartResult] = useState<{ q: string; data: { ids: string[]; chips: { key: string; label: string }[]; mode: string } } | null>(null);
  const smartQ = filters.q.trim();
  // Server ranking only applies to the query it was computed for.
  const smart = smartQ && smartResult?.q === smartQ ? smartResult.data : null;
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);

  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const userMarker = useRef<Marker | null>(null);

  // Load every place once; filtering happens instantly in the browser.
  useEffect(() => {
    fetch("/api/places/map")
      .then((r) => r.json())
      .then((d: { places: MapPlace[] }) => setPlaces(d.places))
      .catch(() => setFailed(t.map.loadError));
  }, [t.map.loadError]);

  // Natural-language query -> server-ranked ids.
  useEffect(() => {
    if (!smartQ) return;
    const ctrl = new AbortController();
    fetch(`/api/search/ids?q=${encodeURIComponent(smartQ)}&locale=${locale}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setSmartResult({ q: smartQ, data }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [smartQ, locale]);

  // Keep the URL shareable.
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.cat) p.set("cat", filters.cat);
    if (filters.area) p.set("area", filters.area);
    if (filters.max) p.set("max", String(filters.max));
    if (filters.free) p.set("free", "1");
    if (filters.open) p.set("open", "1");
    if (filters.rating) p.set("rating", String(filters.rating));
    if (filters.dist) p.set("dist", String(filters.dist));
    if (filters.attrs.length) p.set("attrs", filters.attrs.join(","));
    if (filters.hideChains) p.set("chains", "0");
    if (filters.verified) p.set("verified", "1");
    const qs = p.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [filters, pathname, router]);

  const filtered = useMemo(() => {
    if (!places) return [];
    const idOrder = smart ? new Map(smart.ids.map((id, i) => [id, i])) : null;
    const out = places.filter((p) => {
      if (idOrder && !idOrder.has(p.id)) return false;
      if (filters.cat && !inCat(p, filters.cat)) return false;
      if (filters.area && p.hood !== filters.area) return false;
      if (filters.free && p.basis !== "free") return false;
      if (filters.max && (p.plan == null || p.plan > filters.max)) return false;
      if (filters.open && p.open !== "open") return false;
      if (filters.rating && (p.rating == null || p.rating < filters.rating)) return false;
      if (filters.hideChains && p.flags & FLAG.chain) return false;
      if (filters.verified && !(p.flags & FLAG.verified)) return false;
      for (const a of filters.attrs) {
        const f = ATTR_FLAG[a];
        if (f && !(p.flags & f)) return false;
      }
      if (filters.dist && origin && haversineKm(origin, p) > filters.dist) return false;
      return true;
    });
    if (idOrder) out.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);
    return out;
  }, [places, filters, smart, origin]);

  const inView = useMemo(() => {
    const list = bounds
      ? filtered.filter((p) => p.lng >= bounds[0] && p.lng <= bounds[2] && p.lat >= bounds[1] && p.lat <= bounds[3])
      : filtered;
    if (smart) return list;
    if (origin) return [...list].sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b));
    return [...list].sort((a, b) => quality(b) - quality(a));
  }, [filtered, bounds, origin, smart]);

  const selectedPlace = useMemo(() => places?.find((p) => p.id === selected) ?? null, [places, selected]);

  // Create the map.
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
          center: JEDDAH_CENTER,
          zoom: 11,
          minZoom: 9,
          maxBounds: [
            [JEDDAH_BOUNDS[0][0] - 0.3, JEDDAH_BOUNDS[0][1] - 0.3],
            [JEDDAH_BOUNDS[1][0] + 0.3, JEDDAH_BOUNDS[1][1] + 0.3],
          ],
          attributionControl: { compact: true },
        });
        map.current = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), locale === "ar" ? "bottom-left" : "bottom-right");

        m.on("load", () => {
          if (cancelled) return;
          m.addSource("places", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterMaxZoom: 15, clusterRadius: 46 });
          m.addSource("area", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          m.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": "#127c83", "fill-opacity": 0.07 } });
          m.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#127c83", "line-width": 2, "line-dasharray": [2, 1.5] } });
          m.addLayer({
            id: "clusters",
            type: "circle",
            source: "places",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#0b1b2b",
              "circle-opacity": 0.88,
              "circle-stroke-color": "#fffdf9",
              "circle-stroke-width": 2,
              "circle-radius": ["step", ["get", "point_count"], 16, 20, 20, 100, 26, 400, 32],
            },
          });
          m.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "places",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-allow-overlap": true },
            paint: { "text-color": "#fffdf9" },
          });
          const colorMatch: unknown[] = ["match", ["get", "cat"]];
          for (const c of PLACE_CATEGORIES) colorMatch.push(c.slug, c.color);
          colorMatch.push("#127c83");
          m.addLayer({
            id: "points",
            type: "circle",
            source: "places",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": colorMatch as never,
              "circle-radius": ["case", ["==", ["get", "verified"], 1], 8, 6.5],
              "circle-stroke-color": "#fffdf9",
              "circle-stroke-width": 2,
            },
          });
          m.addLayer({
            id: "selected",
            type: "circle",
            source: "places",
            filter: ["==", ["get", "id"], ""],
            paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#0b1b2b", "circle-stroke-width": 3 },
          });

          m.on("click", "clusters", async (e: MapLayerMouseEvent) => {
            const f = e.features?.[0];
            if (!f) return;
            const src = m.getSource("places") as GeoJSONSource;
            const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
            m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 });
          });
          m.on("click", "points", (e: MapLayerMouseEvent) => {
            const id = e.features?.[0]?.properties?.id as string | undefined;
            if (id) setSelected(id);
          });
          for (const layer of ["clusters", "points"]) {
            m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
            m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
          }
          const updateBounds = () => {
            const b = m.getBounds();
            setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
          };
          m.on("moveend", updateBounds);
          updateBounds();
          setReady(true);
        });
        m.on("error", (e) => {
          if (!m.isStyleLoaded() && e.error) setFailed(t.map.loadError);
        });
      } catch {
        if (!cancelled) setFailed(t.map.noWebgl);
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, [locale, t.map.loadError, t.map.noWebgl]);

  // Push filtered places into the clustered source.
  useEffect(() => {
    if (!ready || !map.current) return;
    const src = map.current.getSource("places") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: filtered.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { id: p.id, cat: p.cat, verified: p.flags & FLAG.verified ? 1 : 0 },
      })),
    });
  }, [filtered, ready]);

  // Highlight the selected marker.
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setFilter("selected", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], selected ?? ""]]);
  }, [selected, ready]);

  // Neighbourhood outline + fit.
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    const src = m.getSource("area") as GeoJSONSource | undefined;
    if (!filters.area) {
      src?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    fetch(`/api/neighbourhoods/${filters.area}`)
      .then((r) => r.json())
      .then((h: { bbox: [number, number, number, number]; polygon: GeoPolygon | null }) => {
        if (h.polygon) src?.setData({ type: "Feature", properties: {}, geometry: h.polygon as GeoJSON.Geometry });
        m.fitBounds([[h.bbox[0], h.bbox[1]], [h.bbox[2], h.bbox[3]]], { padding: 60, duration: 700 });
      })
      .catch(() => {});
  }, [filters.area, ready]);

  // Fit to smart-search results once they arrive.
  useEffect(() => {
    if (!ready || !map.current || !smart || !filtered.length) return;
    const pts = filtered.slice(0, 200);
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    map.current.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 70, maxZoom: 15, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smart, ready]);

  // Show the user's position (only after they asked for it).
  useEffect(() => {
    if (!ready || !map.current) return;
    userMarker.current?.remove();
    userMarker.current = null;
    if (location.kind !== "device") return;
    getMaplibre().then((maplibregl) => {
      if (!map.current) return;
      const dot = document.createElement("div");
      dot.className = "size-4 rounded-full border-[3px] border-white bg-[#2f80ed] shadow-[0_0_0_6px_rgb(47_128_237/0.25)]";
      dot.setAttribute("aria-label", t.map.youAreHere);
      userMarker.current = new maplibregl.Marker({ element: dot }).setLngLat([location.lng, location.lat]).addTo(map.current);
    });
  }, [location, ready, t.map.youAreHere]);

  const locate = useCallback(async () => {
    setLocating(true);
    const r = await requestDevice();
    setLocating(false);
    if (r !== "ok") toast(r === "denied" ? t.map.locationDenied : t.header.locationUnavailable, { tone: "error" });
  }, [requestDevice, toast, t]);

  useEffect(() => {
    if (location.kind === "device" && map.current) map.current.flyTo({ center: [location.lng, location.lat], zoom: 14 });
  }, [location]);

  const focus = (p: MapPlace) => {
    setSelected(p.id);
    setView("map");
    map.current?.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.current.getZoom(), 15.5), duration: 600 });
  };

  const hoodName = (slug: string | null) => {
    const h = slug ? hoods?.find((x) => x.slug === slug) : null;
    return h ? (locale === "ar" ? h.nameAr || h.nameEn : h.nameEn) : null;
  };
  const activeCount =
    (filters.area ? 1 : 0) + (filters.max ? 1 : 0) + (filters.free ? 1 : 0) + (filters.open ? 1 : 0) + (filters.rating ? 1 : 0) + (filters.dist ? 1 : 0) +
    filters.attrs.length + (filters.hideChains ? 1 : 0) + (filters.verified ? 1 : 0);

  const listItems = inView.slice(0, LIST_LIMIT);

  const list = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold" aria-live="polite">
          {places ? plural(locale, inView.length, t.map.results) : t.common.loading}
        </p>
        <span className="text-xs text-ink-400">{t.map.resultsInView}</span>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-24 md:pb-4">
        {listItems.map((p) => (
          <li key={p.id}>
            <MapListRow p={p} active={p.id === selected} onSelect={() => focus(p)} distance={origin ? haversineKm(origin, p) : null} hood={hoodName(p.hood)} />
          </li>
        ))}
        {inView.length > LIST_LIMIT && (
          <li className="px-3 py-4 text-center text-xs text-ink-500">
            {t.map.listLimited.replace("{n}", formatNumber(locale, LIST_LIMIT)).replace("{total}", formatNumber(locale, inView.length))}
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="relative flex h-[calc(100dvh-var(--header-h)-var(--bottom-nav-h))] overflow-hidden md:h-[calc(100dvh-var(--header-h))]">
      {/* Desktop list */}
      <aside className="hidden w-[380px] shrink-0 border-e border-sand-300 bg-sand-50 md:block" aria-label={t.map.list}>
        {list}
      </aside>

      <div className="relative min-w-0 flex-1">
        <div ref={el} style={{ position: "absolute", inset: 0 }} role="region" aria-label={t.map.title} />
        {failed && <div className="absolute inset-0 grid place-items-center bg-sand-100 p-6 text-center text-ink-600">{failed}</div>}

        {/* Mobile list overlay */}
        {view === "list" && <div className="absolute inset-0 z-10 animate-fade-in bg-sand-50 pt-28 md:hidden">{list}</div>}

        {/* Controls */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFilters((f) => ({ ...f, q: query.trim() }));
            }}
            className="pointer-events-auto flex h-12 items-center gap-2 rounded-2xl bg-sand-50 px-4 shadow-lift ring-1 ring-black/5"
            role="search"
          >
            <Search className="size-5 shrink-0 text-sea-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.map.searchPlaceholder}
              aria-label={t.map.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              enterKeyHint="search"
            />
            {(query || filters.q) && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilters((f) => ({ ...f, q: "" }));
                }}
                aria-label={t.map.clearSearch}
                className="rounded-full p-1 text-ink-400 hover:bg-sand-200"
              >
                <X className="size-4" />
              </button>
            )}
          </form>
          {smart && smart.chips.length > 0 && (
            <div className="pointer-events-auto flex flex-wrap gap-1.5">
              {smart.chips.map((c) => (
                <span key={c.key} className="rounded-full bg-sea-50/95 px-2.5 py-1 text-xs text-sea-700 shadow-card">
                  {c.label}
                </span>
              ))}
            </div>
          )}
          <div className="pointer-events-auto rail gap-2" role="group" aria-label={t.explore.category}>
            <ChipBtn active={!filters.cat} onClick={() => setFilters((f) => ({ ...f, cat: null }))} label={t.map.allCategories} />
            {PLACE_CATEGORIES.map((c) => (
              <ChipBtn
                key={c.slug}
                active={filters.cat === c.slug}
                color={c.color}
                label={c.name[locale]}
                onClick={() => setFilters((f) => ({ ...f, cat: f.cat === c.slug ? null : c.slug }))}
              />
            ))}
          </div>
        </div>

        {/* Floating buttons */}
        <div className="absolute end-3 top-[132px] z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(filters);
              setFiltersOpen(true);
            }}
            className="relative grid size-11 place-items-center rounded-full bg-sand-50 shadow-lift ring-1 ring-black/5"
            aria-label={t.map.filters}
          >
            <SlidersHorizontal className="size-5" />
            {activeCount > 0 && (
              <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-sea-500 text-[10px] font-bold text-white">{activeCount}</span>
            )}
          </button>
          <button type="button" onClick={locate} className="grid size-11 place-items-center rounded-full bg-sand-50 shadow-lift ring-1 ring-black/5" aria-label={t.map.locate}>
            <LocateFixed className={`size-5 ${locating ? "animate-pulse text-sea-500" : ""}`} />
          </button>
        </div>

        {/* Mobile map/list toggle */}
        <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center md:hidden">
          <button
            type="button"
            onClick={() => setView((v) => (v === "map" ? "list" : "map"))}
            className="flex h-11 items-center gap-2 rounded-full bg-ink-900 px-5 text-sm font-semibold text-white shadow-lift"
          >
            {view === "map" ? <List className="size-4" /> : <MapIcon className="size-4" />}
            {view === "map" ? `${t.map.list} · ${formatNumber(locale, inView.length)}` : t.map.mapView}
          </button>
        </div>

        {/* Preview */}
        {selectedPlace && view === "map" && (
          <PlacePreview p={selectedPlace} onClose={() => setSelected(null)} distance={origin ? haversineKm(origin, selectedPlace) : null} hood={hoodName(selectedPlace.hood)} />
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t.map.filters}
        labelledBy="map-filters"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDraft({ ...draft, area: null, max: null, free: false, open: false, rating: null, dist: null, attrs: [], hideChains: false, verified: false })}
            >
              {t.common.reset}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setFilters(draft);
                setFiltersOpen(false);
              }}
            >
              {t.common.apply}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.price}</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { label: t.explore.priceAny, max: null, free: false },
                { label: t.explore.priceFree, max: null, free: true },
                ...[50, 100, 200].map((n) => ({ label: t.explore.priceUnder.replace("{n}", formatNumber(locale, n)), max: n, free: false })),
              ].map((o) => (
                <Pill key={o.label} active={draft.free === o.free && draft.max === o.max} onClick={() => setDraft({ ...draft, max: o.max, free: o.free })}>
                  {o.label}
                </Pill>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-500">{t.explore.priceFilterNote}</p>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.attributes}</legend>
            <div className="flex flex-wrap gap-2">
              {ATTR_KEYS.map((a) => {
                const on = draft.attrs.includes(a);
                const label = {
                  family: t.attrs.familyFriendly,
                  indoor: t.attrs.indoor,
                  outdoor: t.attrs.outdoor,
                  groups: t.attrs.groups,
                  photo: t.attrs.photoSpot,
                  wheelchair: t.attrs.wheelchair,
                  late: t.attrs.lateNight,
                }[a as "family"];
                return (
                  <Pill key={a} active={on} onClick={() => setDraft({ ...draft, attrs: on ? draft.attrs.filter((x) => x !== a) : [...draft.attrs, a] })}>
                    {label}
                  </Pill>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.distance}</legend>
            {!origin && <p className="mb-2 text-xs text-ink-500">{t.explore.sortNeedsLocation}</p>}
            <div className="flex flex-wrap gap-2">
              {[null, 1, 3, 5, 10].map((d) => (
                <Pill key={String(d)} active={draft.dist === d} disabled={!origin && d !== null} onClick={() => setDraft({ ...draft, dist: d })}>
                  {d ? t.explore.distanceWithin.replace("{n}", formatNumber(locale, d)) : t.explore.distanceAny}
                </Pill>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.rating}</legend>
            <div className="flex flex-wrap gap-2">
              {[null, 3, 4].map((r) => (
                <Pill key={String(r)} active={draft.rating === r} onClick={() => setDraft({ ...draft, rating: r })}>
                  {r ? t.explore.ratingAtLeast.replace("{n}", formatNumber(locale, r)) : t.explore.ratingAny}
                </Pill>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-500">{t.explore.sortRatingNote}</p>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{t.map.areas}</legend>
            <select value={draft.area ?? ""} onChange={(e) => setDraft({ ...draft, area: e.target.value || null })} className="h-11 w-full rounded-xl border border-sand-300 bg-white px-3">
              <option value="">{t.explore.anyArea}</option>
              {(hoods ?? []).map((h) => (
                <option key={h.slug} value={h.slug}>
                  {locale === "ar" ? h.nameAr || h.nameEn : h.nameEn}
                </option>
              ))}
            </select>
          </fieldset>
          <fieldset className="space-y-3">
            <Toggle checked={draft.open} onChange={(v) => setDraft({ ...draft, open: v })} label={t.explore.openNow} hint={t.explore.openNowNote} />
            <Toggle checked={draft.hideChains} onChange={(v) => setDraft({ ...draft, hideChains: v })} label={t.explore.hideChains} />
            <Toggle checked={draft.verified} onChange={(v) => setDraft({ ...draft, verified: v })} label={t.explore.verifiedOnly} />
          </fieldset>
        </div>
      </Sheet>
    </div>
  );
}

function ChipBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-medium shadow-card transition ${
        active ? "bg-ink-900 text-white" : "bg-sand-50 text-ink-800 ring-1 ring-black/5 hover:bg-white"
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
      {label}
    </button>
  );
}

function PriceLine({ p }: { p: MapPlace }) {
  const { t, locale } = useI18n();
  if (p.basis === "free") return <span className="font-medium text-sea-600">{t.common.free}</span>;
  if (p.min == null || p.max == null) return null;
  return (
    <span>
      {formatSarRange(locale, p.min, p.max)}
      {p.basis === "estimate" && <span className="text-ink-400"> · {t.common.estimate}</span>}
    </span>
  );
}

function MapListRow({ p, active, onSelect, distance, hood }: { p: MapPlace; active: boolean; onSelect: () => void; distance: number | null; hood: string | null }) {
  const { t, locale } = useI18n();
  const def = categoryDef(p.cat);
  const name = (locale === "ar" ? p.ar || p.en : p.en || p.ar) ?? "";
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-2 transition ${active ? "bg-sea-50 ring-1 ring-sea-200" : "hover:bg-sand-200/60"}`}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <span className="relative size-16 shrink-0 overflow-hidden rounded-xl">
          {p.img ? (
            <Image src={p.img} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <CoverArt seed={p.slug} category={p.cat} initial={p.en || p.ar} className="size-full" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">
            <span className="size-1.5 rounded-full" style={{ background: def.color }} />
            <span className="truncate">{subcategoryLabel(p.sub, locale) ?? def.name[locale]}</span>
            {(p.flags & FLAG.verified) !== 0 && <BadgeCheck className="size-3.5 text-sea-500" />}
          </span>
          <span className="block truncate font-semibold">{name}</span>
          <span className="block truncate text-xs text-ink-500">
            {hood}
            {distance != null && ` · ${formatDistance(locale, distance)}`}
          </span>
          <span className="block text-xs text-ink-700">
            <PriceLine p={p} />
          </span>
        </span>
      </button>
      <SaveButton placeId={p.id} variant="icon" />
      <span className="sr-only">{t.common.viewDetails}</span>
    </div>
  );
}

function PlacePreview({ p, onClose, distance, hood }: { p: MapPlace; onClose: () => void; distance: number | null; hood: string | null }) {
  const { t, locale } = useI18n();
  const def = categoryDef(p.cat);
  const name = (locale === "ar" ? p.ar || p.en : p.en || p.ar) ?? "";
  return (
    <section
      aria-label={t.map.preview}
      className="absolute inset-x-2 bottom-2 z-30 animate-sheet-up overflow-hidden rounded-3xl bg-sand-50 shadow-sheet md:inset-x-auto md:bottom-6 md:start-6 md:w-[380px] md:animate-fade-up"
    >
      <div className="relative h-36">
        {p.img ? (
          <Image src={p.img} alt="" fill sizes="380px" className="object-cover" />
        ) : (
          <CoverArt seed={p.slug} category={p.cat} initial={p.en || p.ar} className="absolute inset-0 size-full" />
        )}
        <button type="button" onClick={onClose} className="absolute end-3 top-3 grid size-8 place-items-center rounded-full bg-ink-950/50 text-white backdrop-blur" aria-label={t.common.close}>
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-2 p-4">
        <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-ink-500">
          <span className="size-2 rounded-full" style={{ background: def.color }} />
          {def.name[locale]} · {subcategoryLabel(p.sub, locale) ?? ""}
        </p>
        <h2 className="font-display text-[22px] font-semibold leading-tight">{name}</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-600">
          {hood && <span>{hood}</span>}
          {distance != null && <span>{formatDistance(locale, distance)}</span>}
          {p.rating != null && (
            <span className="flex items-center gap-1">
              <Star className="size-3.5 fill-gold-400 text-gold-400" /> {formatNumber(locale, p.rating)} ({formatNumber(locale, p.reviews)})
            </span>
          )}
          <PriceLine p={p} />
          <span className={p.open === "open" ? "text-sea-600" : "text-ink-500"}>
            {p.open === "open" ? t.place.listedOpen : p.open === "closed" ? t.place.listedClosed : t.map.hoursUnknown}
          </span>
        </div>
        <div className="flex gap-2 pt-2">
          <Link href={`/${locale}/place/${p.slug}`} className={buttonClass("primary", "md", "flex-1")}>
            {t.common.viewDetails}
          </Link>
          <SaveButton placeId={p.id} variant="icon" className="size-11 ring-1 ring-sand-300" />
          <a href={directionsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer" className={buttonClass("dark", "md")} aria-label={t.common.directions}>
            <Navigation className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
