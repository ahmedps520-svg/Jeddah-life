import "server-only";
import type { Itinerary } from "@/lib/db/schema";
import type { Catalog } from "@/lib/places/catalog";
import { evaluate, type PlanSettings, type PlannedStop } from "./engine";
import { withPlaces } from "./respond";

/** Rebuild the live plan (times, travel, current price data) for a saved itinerary. */
export function loadItinerary(catalog: Catalog, it: Itinerary) {
  const settings: PlanSettings = {
    groupType: it.groupType,
    groupSize: it.groupSize,
    budget: it.budget,
    budgetMode: it.budgetMode,
    interests: it.interests,
    date: it.date ?? new Date().toISOString().slice(0, 10),
    startTime: it.startTime ?? "17:00",
    durationMin: it.durationMin,
    start: it.startLat != null && it.startLng != null ? { lat: it.startLat, lng: it.startLng, label: it.startLabel ?? undefined } : null,
    transport: (it.transport as PlanSettings["transport"]) ?? "car",
  };
  const stops = it.stops.map((s) => ({ placeId: s.placeId, kind: (s.note as PlannedStop["kind"]) || "custom", durationMin: s.durationMin }));
  const plan = evaluate(catalog, settings, stops);
  return { settings, plan, places: withPlaces(catalog, [plan]) };
}
