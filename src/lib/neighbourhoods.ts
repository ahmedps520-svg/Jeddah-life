import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { haversineKm, travelEstimate } from "@/lib/places/estimates";
import { rankPlaces } from "@/lib/home";

export async function getNeighbourhood(slug: string) {
  const [row] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.slug, slug));
  return row ?? null;
}

export type HoodSections = {
  popular: PlaceLite[];
  food: PlaceLite[];
  entertainment: PlaceLite[];
  culture: PlaceLite[];
  outdoors: PlaceLite[];
  shopping: PlaceLite[];
};

export function placesIn(c: Catalog, slug: string): PlaceLite[] {
  return c.places.filter((p) => p.hood === slug);
}

/** Places worth pinning on the area map: the best-ranked, one per brand. */
export function mapHighlights(list: PlaceLite[], limit = 40): PlaceLite[] {
  return rankPlaces(list, limit, { perBrand: 1 });
}

export function hoodSections(list: PlaceLite[]): HoodSections {
  // Primary category only, so a mall with a cinema doesn't fill the entertainment row.
  const by = (cats: string[]) => list.filter((p) => cats.includes(p.category));
  return {
    popular: rankPlaces(
      list.filter((p) => !p.chain),
      12,
      { perCategory: 4 },
    ),
    food: rankPlaces(by(["restaurants", "cafes"]), 12),
    entertainment: rankPlaces(by(["entertainment", "adventure", "family", "sports"]), 12),
    culture: rankPlaces(by(["culture"]), 12),
    outdoors: rankPlaces(by(["outdoors", "beaches"]), 12),
    shopping: rankPlaces(by(["shopping"]), 12, { perBrand: 1 }),
  };
}

export type WalkingRoute = {
  stops: PlaceLite[];
  /** Estimated walking distance along the route (km) */
  km: number;
  walkMinutes: number;
};

/** Longest single leg we'd suggest walking, as estimated walking distance. */
const MAX_LEG_KM = 1.2;

/**
 * A short walking route through a neighbourhood, built only from real
 * coordinates. Returns null unless at least three worthwhile stops are each
 * within a comfortable walk of the previous one — many Jeddah districts are
 * car-oriented and shouldn't pretend otherwise.
 */
export function walkingRoute(list: PlaceLite[]): WalkingRoute | null {
  const sights = rankPlaces(
    list.filter((p) => ["culture", "outdoors", "beaches"].includes(p.category) || p.sub === "souq"),
    12,
  );
  if (sights.length < 3) return null;

  let best: WalkingRoute | null = null;
  for (const first of sights.slice(0, 4)) {
    const stops = [first];
    let km = 0;
    while (stops.length < 5) {
      const last = stops[stops.length - 1];
      const next = sights
        .filter((p) => !stops.includes(p))
        .map((p) => ({ p, leg: travelEstimate(last, p, "walk").km }))
        .filter((x) => x.leg <= MAX_LEG_KM && x.leg >= 0.05)
        .sort((a, b) => a.leg - b.leg)[0];
      if (!next) break;
      stops.push(next.p);
      km += next.leg;
    }
    if (stops.length < 3) continue;
    // Finish with a café or restaurant close to the last stop, if there is one.
    const last = stops[stops.length - 1];
    const rest = rankPlaces(
      list.filter((p) => (p.category === "cafes" || p.category === "restaurants") && !p.chain && haversineKm(last, p) * 1.25 <= 0.6),
      1,
    )[0];
    if (rest) {
      km += travelEstimate(last, rest, "walk").km;
      stops.push(rest);
    }
    if (!best || stops.length > best.stops.length || (stops.length === best.stops.length && km < best.km)) {
      best = { stops, km, walkMinutes: Math.round((km / 4.5) * 60) };
    }
  }
  return best;
}
