import { describe, expect, it } from "vitest";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { budgetPerPerson, buildPlan, evaluate, type PlanSettings } from "@/lib/planner/engine";

let n = 0;
function place(category: string, sub: string, planning: number | null, extra: Partial<PlaceLite> = {}): PlaceLite {
  n++;
  const free = planning === 0;
  return {
    id: `p${n}`,
    slug: `p${n}`,
    nameEn: `${sub} ${n}`,
    nameAr: null,
    category,
    secondary: [],
    sub,
    // Spread around central Jeddah, a few hundred metres apart.
    lat: 21.54 + (n % 7) * 0.004,
    lng: 39.17 + (n % 5) * 0.004,
    hood: "al-hamra",
    img: null,
    cost: { min: planning, max: planning, planning, basis: free ? "free" : planning == null ? "unknown" : "estimate" },
    level: null,
    attrs: free ? { free: true } : {},
    open: null,
    late: false,
    hasHours: false,
    ver: "verified",
    pick: false,
    gem: false,
    chain: false,
    brand: null,
    rating: null,
    reviews: 0,
    saves: 0,
    pop: 0,
    added: 0,
    tags: [],
    occasions: [],
    hasDescription: false,
    ...extra,
  };
}

function catalog(places: PlaceLite[]): Catalog {
  return {
    places,
    byId: new Map(places.map((p) => [p.id, p])),
    bySlug: new Map(places.map((p) => [p.slug, p])),
    docs: [],
    hoods: [],
    hoodBySlug: new Map(),
    hoodVocab: [],
    hours: new Map(),
    builtAt: Date.now(),
  };
}

const places = [
  ...Array.from({ length: 6 }, () => place("cafes", "coffee_shop", 25)),
  ...Array.from({ length: 6 }, () => place("restaurants", "restaurant", 80)),
  ...Array.from({ length: 4 }, () => place("restaurants", "steakhouse", 160)),
  ...Array.from({ length: 4 }, () => place("entertainment", "escape_room", 120)),
  ...Array.from({ length: 4 }, () => place("outdoors", "park", 0)),
  ...Array.from({ length: 3 }, () => place("culture", "museum", 30)),
];
const c = catalog(places);

const base: PlanSettings = {
  groupType: "friends",
  groupSize: 4,
  budget: 150,
  budgetMode: "per_person",
  interests: [],
  date: "2026-10-29",
  startTime: "17:00",
  durationMin: 240,
  start: null,
  transport: "car",
};

describe("planner", () => {
  it("converts a group budget to a per-person budget", () => {
    expect(budgetPerPerson({ budget: 400, budgetMode: "group", groupSize: 4 })).toBe(100);
    expect(budgetPerPerson({ budget: 100, budgetMode: "per_person", groupSize: 4 })).toBe(100);
    expect(budgetPerPerson({ budget: null, budgetMode: "group", groupSize: 4 })).toBeNull();
  });

  it("builds a plan from real catalogue places within the budget", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = buildPlan(c, base, { seed });
      expect(plan).not.toBeNull();
      expect(plan!.stops.length).toBeGreaterThanOrEqual(2);
      for (const s of plan!.stops) expect(c.byId.has(s.placeId)).toBe(true);
      expect(plan!.totals.perPerson).toBeLessThanOrEqual(150);
      expect(plan!.totals.overPerPerson).toBe(0);
    }
  });

  it("stays within a tight budget by dropping or swapping stops", () => {
    const plan = buildPlan(c, { ...base, budget: 40 }, { seed: 7 });
    expect(plan).not.toBeNull();
    expect(plan!.totals.perPerson).toBeLessThanOrEqual(40);
  });

  it("is deterministic for a seed", () => {
    const a = buildPlan(c, base, { seed: 42 })!.stops.map((s) => s.placeId);
    const b = buildPlan(c, base, { seed: 42 })!.stops.map((s) => s.placeId);
    expect(a).toEqual(b);
  });

  it("fits the available time", () => {
    const plan = buildPlan(c, { ...base, durationMin: 180 }, { seed: 3 })!;
    expect(plan.totals.totalMinutes).toBeLessThanOrEqual(180);
  });

  it("explains which stops push an edited plan over budget", () => {
    const steak = places.find((p) => p.sub === "steakhouse")!;
    const room = places.find((p) => p.sub === "escape_room")!;
    const plan = evaluate(c, { ...base, budget: 100 }, [
      { placeId: room.id, kind: "activity" },
      { placeId: steak.id, kind: "meal" },
    ]);
    expect(plan.totals.perPerson).toBe(280);
    expect(plan.totals.overPerPerson).toBe(180);
    expect(plan.totals.overStops[0]).toBe(steak.id);
  });

  it("counts places without a price separately instead of as free", () => {
    const unknown = place("entertainment", "arcade", null);
    const cc = catalog([...places, unknown]);
    const plan = evaluate(cc, base, [{ placeId: unknown.id, kind: "activity" }]);
    expect(plan.totals.unknownStops).toBe(1);
    expect(plan.stops[0].cost.basis).toBe("unknown");
  });
});
