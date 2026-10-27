import "server-only";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { haversineKm, travelEstimate, typicalDuration, type LatLng, type TravelMode } from "@/lib/places/estimates";
import { cityWallAt, openDuring } from "@/lib/places/hours";
import { inCategory } from "@/lib/search/engine";

/**
 * Outing planner.
 *
 * Builds a sequence of stops from real published places. Every number it
 * produces is either from data (verified price, free entry, listed hours)
 * or an explicitly labelled estimate (typical spend, time at a stop,
 * straight-line travel with a detour factor). Places whose listed hours say
 * they are closed at the planned time are never chosen; places without
 * listed hours can be chosen but are flagged.
 */

export type SlotKind = "coffee" | "meal" | "dessert" | "activity" | "scenic" | "culture" | "shopping";

export type PlanSettings = {
  groupType: string;
  groupSize: number;
  /** Budget amount in SAR; null = no limit given */
  budget: number | null;
  budgetMode: "per_person" | "group";
  interests: string[];
  date: string;
  startTime: string;
  durationMin: number;
  start: (LatLng & { label?: string }) | null;
  transport: TravelMode;
};

export type PlannedStop = {
  placeId: string;
  kind: SlotKind | "custom";
  arriveAt: string;
  durationMin: number;
  travel: { km: number; minutes: number; basis: "estimate" } | null;
  cost: { perPerson: number | null; min: number | null; max: number | null; basis: PlaceLite["cost"]["basis"] };
  open: boolean | null;
};

export type PlanTotals = {
  perPerson: number;
  group: number;
  unknownStops: number;
  budgetPerPerson: number | null;
  budgetGroup: number | null;
  overPerPerson: number;
  overGroup: number;
  /** Stops that push the plan over budget, most expensive first */
  overStops: string[];
  totalMinutes: number;
  endsAt: string;
  overTimeMin: number;
};

export type Plan = { stops: PlannedStop[]; totals: PlanTotals; walkable: boolean };

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + Math.round(min);
  const d = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
}

function dayAfter(date: string, n: number) {
  const d = new Date(Date.parse(date + "T12:00:00Z") + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function budgetPerPerson(s: Pick<PlanSettings, "budget" | "budgetMode" | "groupSize">): number | null {
  if (s.budget == null) return null;
  return s.budgetMode === "group" ? s.budget / Math.max(1, s.groupSize) : s.budget;
}

const DESSERT = /^(ice_cream_shop|gelato_shop|frozen_yogurt_shop|dessert_shop|donut_shop|cupcake_shop|chocolatier|bakery|smoothie_juice_bar|bubble_tea_shop)$/;
const FAST = /^(fast_food_restaurant|sandwich_shop|chicken_restaurant|food_truck_stand)$/;
const GAMES = /^(escape_room|bowling_alley|arcade|comedy_club|pool_billiards|movie_theater|fairgrounds|trampoline_park)$/;

function matchesKind(p: PlaceLite, kind: SlotKind, interests: string[]): boolean {
  switch (kind) {
    case "coffee":
      return p.category === "cafes" && !DESSERT.test(p.sub ?? "");
    case "dessert":
      return p.category === "cafes" && DESSERT.test(p.sub ?? "");
    case "meal":
      return p.category === "restaurants";
    case "culture":
      return inCategory(p, "culture");
    case "shopping":
      return inCategory(p, "shopping");
    case "scenic":
      return ["outdoors", "beaches"].includes(p.category) || (p.attrs.photo === true && p.category !== "restaurants" && p.category !== "cafes");
    case "activity": {
      const wants = interests.filter((i) => ["adventure", "gaming", "sports", "entertainment", "family"].includes(i));
      const isActivity =
        ["entertainment", "adventure", "family", "sports"].some((c) => inCategory(p, c)) &&
        !["restaurants", "cafes", "shopping"].includes(p.category);
      if (!isActivity) return false;
      if (!wants.length) return true;
      return wants.some((w) =>
        w === "gaming" ? GAMES.test(p.sub ?? "") : w === "family" ? inCategory(p, "family") : inCategory(p, w),
      );
    }
  }
}

/** Natural order of a day out. */
const ORDER: Record<SlotKind, number> = { coffee: 0, culture: 1, shopping: 2, activity: 3, meal: 4, dessert: 5, scenic: 6 };

export function slotsFor(s: PlanSettings): SlotKind[] {
  const n = s.durationMin <= 120 ? 2 : s.durationMin <= 210 ? 3 : s.durationMin <= 300 ? 4 : 5;
  const want: SlotKind[] = [];
  const add = (k: SlotKind) => {
    if (!want.includes(k) || (k === "activity" && want.filter((x) => x === "activity").length < 2)) want.push(k);
  };
  for (const i of s.interests) {
    if (i === "coffee") add("coffee");
    if (i === "food") add("meal");
    if (i === "luxury") add("meal");
    if (i === "shopping") add("shopping");
    if (i === "culture") add("culture");
    if (i === "photography") add("scenic");
    if (i === "beaches" || i === "relaxation") add("scenic");
    if (["adventure", "gaming", "sports", "entertainment", "family"].includes(i)) add("activity");
  }
  if (s.budget === 0) {
    // Free outings: public spaces and free culture only.
    const free = want.filter((k) => k === "scenic" || k === "culture" || k === "shopping");
    const base: SlotKind[] = free.length ? free : ["scenic", "culture"];
    while (base.length < Math.min(n, 3)) base.push(base.includes("scenic") ? "culture" : "scenic");
    return [...new Set(base)].slice(0, n).sort((a, b) => ORDER[a] - ORDER[b]);
  }
  const start = minutesOf(s.startTime);
  const end = start + s.durationMin;
  const spansMeal = (start <= 13 * 60 && end >= 13 * 60) || (start <= 20 * 60 && end >= 20 * 60);
  if (!want.length) want.push("coffee", "activity", "meal", "scenic");
  if (spansMeal && !want.includes("meal") && n >= 3) want.push("meal");
  const fillers: SlotKind[] = ["coffee", "scenic", "activity", "dessert", "culture"];
  for (const f of fillers) if (want.length < n && !want.includes(f)) want.push(f);
  return want.slice(0, n).sort((a, b) => ORDER[a] - ORDER[b]);
}

/** When no place fits a slot (budget, hours, distance), try these instead. */
const FALLBACK: Record<SlotKind, SlotKind[]> = {
  coffee: ["dessert", "scenic"],
  meal: ["dessert", "coffee", "scenic"],
  dessert: ["coffee", "scenic"],
  activity: ["culture", "scenic", "shopping"],
  scenic: ["culture", "shopping"],
  culture: ["scenic", "shopping"],
  shopping: ["scenic", "culture"],
};

/** Cheapest plausible cost for a kind, used to reserve budget for later stops. */
const RESERVE: Record<SlotKind, number> = { coffee: 15, meal: 20, dessert: 10, activity: 0, scenic: 0, culture: 0, shopping: 0 };

type PickOpts = {
  catalog: Catalog;
  s: PlanSettings;
  kind: SlotKind;
  from: LatLng | null;
  arrive: string;
  arriveDate: string;
  remaining: number | null;
  reserve: number;
  used: Set<string>;
  usedBrands: Set<string>;
  rand: () => number;
  exclude?: Set<string>;
};

function candidates(o: PickOpts, limit: number): Array<{ p: PlaceLite; score: number; open: boolean | null; cost: number | null }> {
  const { catalog, s, kind } = o;
  const maxLeg = s.transport === "walk" ? 1.6 : 14;
  const family = s.groupType === "family";
  const at = cityWallAt(o.arriveDate, o.arrive);
  const duration = (p: PlaceLite) => typicalDuration(p.category, p.sub);
  const out: Array<{ p: PlaceLite; score: number; open: boolean | null; cost: number | null }> = [];
  for (const p of catalog.places) {
    if (o.used.has(p.id) || o.exclude?.has(p.id)) continue;
    if (p.brand && o.usedBrands.has(p.brand)) continue;
    if (!matchesKind(p, kind, s.interests)) continue;
    if (family && !(p.attrs.family || p.category === "restaurants" || p.category === "cafes")) continue;
    const d = o.from ? haversineKm(o.from, p) : 0;
    if (o.from && d > maxLeg) continue;
    const cost = p.cost.planning;
    if (s.budget === 0 && p.cost.basis !== "free") continue;
    if (o.remaining != null && cost != null && cost > o.remaining - o.reserve) continue;
    const hours = catalog.hours.get(p.id);
    const open = hours ? openDuring(hours, at, Math.min(duration(p), 60)) : null;
    if (open === false) continue;

    let score = 10;
    if (p.ver === "verified") score += 6;
    if (p.pick) score += 4;
    if (p.img) score += 3;
    if (p.hasDescription) score += 2;
    if (p.chain) score -= 6;
    if (p.rating != null && p.reviews >= 2) score += (p.rating - 3) * 3;
    if (open === true) score += 3;
    if (cost == null) score -= kind === "activity" ? 3 : 8;
    if (s.interests.includes("luxury") && (p.level ?? 0) >= 3) score += 5;
    if (s.interests.includes("photography") && p.attrs.photo) score += 4;
    if (s.interests.includes("relaxation") && (p.attrs.quiet || p.category === "beaches")) score += 3;
    if (s.groupType === "couple" && p.attrs.romantic) score += 3;
    if ((s.groupType === "friends" || s.groupType === "large") && p.attrs.groups) score += 3;
    if (kind === "meal" && o.remaining != null && o.remaining < 45 && FAST.test(p.sub ?? "")) score += 4;
    score -= d * (s.transport === "walk" ? 6 : 1.2);
    score += o.rand() * 6;
    out.push({ p, score, open, cost });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Compute the timeline and totals for a fixed list of stops. */
export function evaluate(
  catalog: Catalog,
  s: PlanSettings,
  stops: Array<{ placeId: string; kind: PlannedStop["kind"]; durationMin?: number }>,
): Plan {
  let clock = s.startTime;
  let dayOffset = 0;
  let prev: LatLng | null = s.start;
  let minutes = 0;
  const planned: PlannedStop[] = [];
  for (const st of stops) {
    const p = catalog.byId.get(st.placeId);
    if (!p) continue;
    let travel: PlannedStop["travel"] = null;
    if (prev) {
      const tr = travelEstimate(prev, p, s.transport);
      travel = { km: Math.round(tr.km * 10) / 10, minutes: tr.minutes, basis: "estimate" };
      if (minutesOf(clock) + tr.minutes >= 1440) dayOffset++;
      clock = addMinutes(clock, tr.minutes);
      minutes += tr.minutes;
    }
    const duration = st.durationMin ?? typicalDuration(p.category, p.sub);
    const hours = catalog.hours.get(p.id);
    const open = hours ? openDuring(hours, cityWallAt(dayAfter(s.date, dayOffset), clock), Math.min(duration, 60)) : null;
    planned.push({
      placeId: p.id,
      kind: st.kind,
      arriveAt: clock,
      durationMin: duration,
      travel,
      cost: { perPerson: p.cost.planning, min: p.cost.min, max: p.cost.max, basis: p.cost.basis },
      open,
    });
    if (minutesOf(clock) + duration >= 1440) dayOffset++;
    clock = addMinutes(clock, duration);
    minutes += duration;
    prev = p;
  }
  const perPerson = planned.reduce((sum, x) => sum + (x.cost.perPerson ?? 0), 0);
  const bpp = budgetPerPerson(s);
  const overPerPerson = bpp != null ? Math.max(0, Math.round(perPerson - bpp)) : 0;
  let overStops: string[] = [];
  if (overPerPerson > 0) {
    let acc = 0;
    overStops = [...planned]
      .filter((x) => (x.cost.perPerson ?? 0) > 0)
      .sort((a, b) => (b.cost.perPerson ?? 0) - (a.cost.perPerson ?? 0))
      .filter((x) => {
        if (acc >= overPerPerson) return false;
        acc += x.cost.perPerson ?? 0;
        return true;
      })
      .map((x) => x.placeId);
  }
  const legs = planned.map((x) => x.travel?.km ?? 0).slice(1);
  return {
    stops: planned,
    totals: {
      perPerson: Math.round(perPerson),
      group: Math.round(perPerson * s.groupSize),
      unknownStops: planned.filter((x) => x.cost.basis === "unknown").length,
      budgetPerPerson: bpp != null ? Math.round(bpp) : null,
      budgetGroup: bpp != null ? Math.round(bpp * s.groupSize) : null,
      overPerPerson,
      overGroup: overPerPerson * s.groupSize,
      overStops,
      totalMinutes: minutes,
      endsAt: clock,
      overTimeMin: Math.max(0, minutes - s.durationMin),
    },
    walkable: planned.length > 1 && legs.every((km) => km <= 1.2),
  };
}

const minCostCache = new WeakMap<Catalog, Map<SlotKind, number>>();

/** Lowest typical per-person cost among places that can fill a slot kind. */
function minCost(catalog: Catalog, kind: SlotKind): number {
  let m = minCostCache.get(catalog);
  if (!m) {
    m = new Map();
    minCostCache.set(catalog, m);
  }
  if (!m.has(kind)) {
    let min = Number.POSITIVE_INFINITY;
    for (const p of catalog.places) if (p.cost.planning != null && matchesKind(p, kind, [])) min = Math.min(min, p.cost.planning);
    m.set(kind, Number.isFinite(min) ? min : 0);
  }
  return m.get(kind)!;
}

/** Which slots to give up first when the budget can't cover them all. */
const KEEP: Record<SlotKind, number> = { meal: 5, activity: 4, coffee: 3, dessert: 2, culture: 1, shopping: 1, scenic: 1 };

/**
 * Drop the least important paid slots until the cheapest possible version of
 * the outing fits the budget, then fill freed time with a free scenic stop.
 */
function affordable(catalog: Catalog, kinds: SlotKind[], bpp: number | null): SlotKind[] {
  if (bpp == null) return kinds;
  const out = [...kinds];
  const total = () => out.reduce((sum, k) => sum + minCost(catalog, k), 0);
  let dropped = false;
  while (out.length > 1 && total() > bpp) {
    const paid = out.filter((k) => minCost(catalog, k) > 0);
    if (!paid.length) break;
    const victim = paid.sort((a, b) => KEEP[a] - KEEP[b])[0];
    out.splice(out.indexOf(victim), 1);
    dropped = true;
  }
  if (dropped && !out.includes("scenic")) out.push("scenic");
  return out.sort((a, b) => ORDER[a] - ORDER[b]);
}

/** Build a plan for a given sequence of slot kinds. */
export function buildPlan(
  catalog: Catalog,
  s: PlanSettings,
  opts: { kinds?: SlotKind[]; seed?: number; mustInclude?: string | null; exclude?: string[] } = {},
): Plan | null {
  const kinds = affordable(catalog, opts.kinds ?? slotsFor(s), budgetPerPerson(s));
  const rand = mulberry32(opts.seed ?? Date.now());
  const bpp = budgetPerPerson(s);
  const used = new Set<string>();
  const usedBrands = new Set<string>();
  const exclude = new Set(opts.exclude ?? []);
  const chosen: Array<{ placeId: string; kind: PlannedStop["kind"]; durationMin: number }> = [];
  let remaining = bpp;
  let elapsed = 0;
  let clock = s.startTime;
  let dayOffset = 0;
  let from: LatLng | null = s.start;

  // A place the user asked to include anchors the plan.
  const must = opts.mustInclude ? catalog.byId.get(opts.mustInclude) : null;
  let mustKindIndex = -1;
  if (must) {
    mustKindIndex = kinds.findIndex((k) => matchesKind(must, k, s.interests));
    if (mustKindIndex < 0) {
      kinds.splice(Math.min(1, kinds.length), 0, "activity");
      mustKindIndex = Math.min(1, kinds.length - 1);
    }
  }

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const reserve = kinds.slice(i + 1).reduce((sum, k) => sum + RESERVE[k], 0);
    // Share the time that's left between the remaining stops (allowing ~15 min to travel to each).
    const slotsLeft = kinds.length - i;
    const share = (s.durationMin - elapsed) / slotsLeft - (from ? 15 : 0);
    if (share < 30) break;
    let pick: PlaceLite | null = null;
    let pickedKind: SlotKind = kind;
    if (must && i === mustKindIndex) pick = must;
    else {
      for (const k of [kind, ...FALLBACK[kind]]) {
        if (k !== kind && chosen.some((c) => c.kind === k) && k !== "scenic") continue;
        const list = candidates(
          { catalog, s, kind: k, from, arrive: clock, arriveDate: dayAfter(s.date, dayOffset), remaining, reserve: k === kind ? reserve : 0, used, usedBrands, rand, exclude },
          8,
        );
        // Weighted pick among the best few keeps plans varied but sensible.
        if (list.length) {
          pick = list[Math.floor(rand() * Math.min(3, list.length))].p;
          pickedKind = k;
          break;
        }
      }
    }
    if (!pick) continue;
    used.add(pick.id);
    if (pick.brand) usedBrands.add(pick.brand);
    const tr = from ? travelEstimate(from, pick, s.transport).minutes : 0;
    const dur = Math.max(30, Math.min(typicalDuration(pick.category, pick.sub), Math.floor(((s.durationMin - elapsed) / slotsLeft - tr) / 5) * 5));
    chosen.push({ placeId: pick.id, kind: pickedKind, durationMin: dur });
    if (remaining != null && pick.cost.planning != null) remaining -= pick.cost.planning;
    elapsed += tr + dur;
    if (minutesOf(clock) + tr + dur >= 1440) dayOffset++;
    clock = addMinutes(clock, tr + dur);
    from = pick;
  }
  if (!chosen.length) return null;
  return evaluate(catalog, s, chosen);
}

/** Alternatives for one stop, respecting the rest of the plan. */
export function alternatives(
  catalog: Catalog,
  s: PlanSettings,
  stops: Array<{ placeId: string; kind: PlannedStop["kind"] }>,
  index: number,
  limit = 6,
): PlaceLite[] {
  const current = stops[index];
  const place = catalog.byId.get(current.placeId);
  const kind: SlotKind =
    current.kind !== "custom"
      ? current.kind
      : place?.category === "restaurants"
        ? "meal"
        : place?.category === "cafes"
          ? "coffee"
          : place?.category === "culture"
            ? "culture"
            : ["outdoors", "beaches"].includes(place?.category ?? "")
              ? "scenic"
              : "activity";
  const prev = index > 0 ? catalog.byId.get(stops[index - 1].placeId) : s.start;
  const plan = evaluate(catalog, s, stops);
  const others = plan.totals.perPerson - (plan.stops[index]?.cost.perPerson ?? 0);
  const bpp = budgetPerPerson(s);
  const used = new Set(stops.map((x) => x.placeId));
  const usedBrands = new Set(stops.map((x) => catalog.byId.get(x.placeId)?.brand).filter(Boolean) as string[]);
  return candidates(
    {
      catalog,
      s,
      kind,
      from: prev ?? null,
      arrive: plan.stops[index]?.arriveAt ?? s.startTime,
      arriveDate: s.date,
      remaining: bpp != null ? bpp - others : null,
      reserve: 0,
      used,
      usedBrands,
      rand: mulberry32(index * 7919 + stops.length),
    },
    limit,
  ).map((c) => c.p);
}
