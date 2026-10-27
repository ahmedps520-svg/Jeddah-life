import "server-only";
import type { Catalog } from "@/lib/places/catalog";
import { buildPlan, mulberry32, type Plan, type PlanSettings, type SlotKind } from "./engine";

export type OptionKey = "food" | "adventure" | "chill" | "surprise";
export type PlanOption = { key: OptionKey; plan: Plan | null };

function fit(kinds: SlotKind[], minutes: number): SlotKind[] {
  if (minutes <= 120) return kinds.slice(0, 2);
  return kinds;
}

/** "We have a budget": three themed outings built from the same constraints. */
export function makeItHappen(catalog: Catalog, s: PlanSettings, seed: number): PlanOption[] {
  const food: SlotKind[] = s.budget === 0 ? ["scenic", "culture"] : ["coffee", "meal", "dessert"];
  const adventure: SlotKind[] = s.budget === 0 ? ["scenic", "culture", "scenic"] : ["activity", "dessert", "scenic"];
  const chill: SlotKind[] = s.budget === 0 ? ["scenic", "culture"] : ["scenic", "coffee", "scenic"];
  const advSettings = { ...s, interests: s.interests.filter((i) => ["adventure", "gaming", "sports", "entertainment", "family"].includes(i)) };
  return [
    { key: "food", plan: buildPlan(catalog, { ...s, interests: [] }, { kinds: fit(food, s.durationMin), seed }) },
    { key: "adventure", plan: buildPlan(catalog, advSettings, { kinds: fit(adventure, s.durationMin), seed: seed + 1 }) },
    { key: "chill", plan: buildPlan(catalog, { ...s, interests: ["relaxation"] }, { kinds: fit(chill, s.durationMin), seed: seed + 2 }) },
  ];
}

/** A random outing that still respects budget, time and group. */
export function surprise(catalog: Catalog, s: PlanSettings, seed: number): PlanOption {
  const rand = mulberry32(seed);
  const pool: SlotKind[] = s.budget === 0 ? ["scenic", "culture", "shopping"] : ["coffee", "activity", "meal", "dessert", "scenic", "culture", "shopping"];
  const n = s.durationMin <= 120 ? 2 : s.durationMin <= 240 ? 3 : 4;
  const kinds: SlotKind[] = [];
  while (kinds.length < n) {
    const k = pool[Math.floor(rand() * pool.length)];
    if (!kinds.includes(k) || k === "scenic") kinds.push(k);
  }
  return { key: "surprise", plan: buildPlan(catalog, { ...s, interests: [] }, { kinds, seed }) };
}
