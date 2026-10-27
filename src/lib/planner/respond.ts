import "server-only";
import type { Catalog } from "@/lib/places/catalog";
import type { Plan } from "./engine";
import type { PlaceLite } from "@/lib/places/types";

/** Attach the place records a plan refers to, so the client can render it. */
export function withPlaces(catalog: Catalog, plans: Array<Plan | null>) {
  const places: Record<string, PlaceLite> = {};
  for (const plan of plans) for (const s of plan?.stops ?? []) {
    const p = catalog.byId.get(s.placeId);
    if (p) places[p.id] = p;
  }
  return places;
}
