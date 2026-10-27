import "server-only";
import { db } from "@/lib/db";
import { neighbourhoods, type GeoPolygon } from "@/lib/db/schema";
import { JEDDAH_BOUNDS } from "@/lib/map/style";

function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inPolygon(lng: number, lat: number, poly: GeoPolygon): boolean {
  const polys = (poly.type === "Polygon" ? [poly.coordinates] : poly.coordinates) as number[][][][];
  return polys.some(([outer, ...holes]) => inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h)));
}

export function inJeddah(lat: number, lng: number): boolean {
  const [[w, s], [e, n]] = JEDDAH_BOUNDS;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

const cache = globalThis as unknown as { __jlHoodPolys?: Promise<{ slug: string; polygon: GeoPolygon }[]> };

/** The neighbourhood whose boundary contains the point, if any. */
export async function neighbourhoodAt(lat: number, lng: number): Promise<string | null> {
  cache.__jlHoodPolys ??= db
    .select({ slug: neighbourhoods.slug, polygon: neighbourhoods.polygon })
    .from(neighbourhoods)
    .then((rows) => rows.filter((r): r is { slug: string; polygon: GeoPolygon } => !!r.polygon))
    .catch((err) => {
      cache.__jlHoodPolys = undefined;
      throw err;
    });
  const polys = await cache.__jlHoodPolys;
  return polys.find((h) => inPolygon(lng, lat, h.polygon))?.slug ?? null;
}
