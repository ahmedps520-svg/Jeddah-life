import type { StyleSpecification, LayerSpecification, ExpressionSpecification } from "maplibre-gl";

/**
 * Map style: OpenFreeMap's "positron" vector style (OpenStreetMap data,
 * free to use, no API key), recoloured to the JEDDAH LIFE palette and with
 * labels in the active language. Set NEXT_PUBLIC_MAP_STYLE_URL to use a
 * different provider's MapLibre-compatible style instead (e.g. MapTiler,
 * Stadia or a self-hosted tileserver).
 */

export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
export const JEDDAH_CENTER: [number, number] = [39.1728, 21.5433];
export const JEDDAH_BOUNDS: [[number, number], [number, number]] = [
  [38.9, 21.2],
  [39.45, 22.0],
];

const PALETTE = {
  land: "#f4efe6",
  water: "#bfe0df",
  waterLine: "#9fd0ce",
  park: "#dfe9d6",
  building: "#e9e1d3",
  roadMinor: "#ffffff",
  roadMajor: "#fffaf0",
  roadCasing: "#e3d8c5",
  label: "#2e4a66",
  labelHalo: "#fffdf9",
};

const styleCache = new Map<string, StyleSpecification>();

export async function loadMapStyle(locale: "en" | "ar"): Promise<StyleSpecification | string> {
  const url = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE_URL;
  const custom = !!process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  if (custom) return url;
  const key = `${url}|${locale}`;
  if (styleCache.has(key)) return styleCache.get(key)!;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`style ${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  const nameExpr = (
    locale === "ar"
      ? ["coalesce", ["get", "name:ar"], ["get", "name"], ["get", "name_en"]]
      : ["coalesce", ["get", "name_en"], ["get", "name:en"], ["get", "name:latin"], ["get", "name"]]
  ) as ExpressionSpecification;

  style.layers = style.layers.map((layer) => {
    const l = { ...layer } as LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };
    const id = l.id;
    if (l.type === "background") l.paint = { ...l.paint, "background-color": PALETTE.land };
    if (l.type === "fill" && /water/.test(id)) l.paint = { ...l.paint, "fill-color": PALETTE.water };
    if (l.type === "line" && /waterway/.test(id)) l.paint = { ...l.paint, "line-color": PALETTE.waterLine };
    if (l.type === "fill" && /park|wood|grass/.test(id)) l.paint = { ...l.paint, "fill-color": PALETTE.park };
    if (l.type === "fill" && /building/.test(id)) l.paint = { ...l.paint, "fill-color": PALETTE.building };
    if (l.type === "fill" && /residential/.test(id)) l.paint = { ...l.paint, "fill-color": "#efe8dc" };
    if (l.type === "line" && /casing/.test(id)) l.paint = { ...l.paint, "line-color": PALETTE.roadCasing };
    else if (l.type === "line" && /highway_minor|path/.test(id)) l.paint = { ...l.paint, "line-color": PALETTE.roadMinor };
    else if (l.type === "line" && /highway_(major|motorway)/.test(id)) l.paint = { ...l.paint, "line-color": PALETTE.roadMajor };
    if (l.type === "symbol" && l.layout && "text-field" in l.layout && !/shield/.test(id)) {
      l.layout = { ...l.layout, "text-field": nameExpr };
      l.paint = { ...l.paint, "text-color": PALETTE.label, "text-halo-color": PALETTE.labelHalo, "text-halo-width": 1.4 };
    }
    return l as LayerSpecification;
  });
  styleCache.set(key, style);
  return style;
}

export function directionsUrl(lat: number, lng: number, provider: "google" | "apple" = "google") {
  return provider === "apple"
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
