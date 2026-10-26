/**
 * Cost and travel estimates.
 *
 * JEDDAH LIFE has no live price feed. When an editor has recorded a price
 * range from an official source we use it ("verified"). Public spaces with
 * free entry cost nothing ("free"). For food and drink we fall back to a
 * typical-spend band for that type of place ("estimate"), which the UI always
 * labels as an estimate. Everything else is "unknown" and is never counted as
 * free.
 */

export type CostBasis = "verified" | "free" | "estimate" | "unknown";

export type CostEstimate = {
  min: number | null;
  max: number | null;
  /** Value used when adding up an itinerary (per person). */
  planning: number | null;
  basis: CostBasis;
};

type PriceInput = {
  category: string;
  subcategory: string | null;
  priceMin: number | null;
  priceMax: number | null;
  attributes?: { free?: { value: boolean | null } | undefined } | null;
};

/** Typical per-person spend bands in SAR by venue type (food & drink only). */
const BANDS: Array<[RegExp, number, number]> = [
  [/^(coffee_shop|cafe|coffee_roastery|tea_room|bubble_tea_shop)$/, 15, 35],
  [/^smoothie_juice_bar$/, 12, 30],
  [/^(ice_cream_shop|gelato_shop|frozen_yogurt_shop|donut_shop|cupcake_shop|bakery|dessert_shop)$/, 10, 35],
  [/^chocolatier$/, 20, 70],
  [/^(fast_food_restaurant|sandwich_shop|chicken_restaurant|food_truck_stand|doner_kebab_restaurant)$/, 20, 40],
  [/^pizza_restaurant$/, 30, 60],
  [/^burger_restaurant$/, 35, 70],
  [
    /^(middle_eastern|indian|pakistani|egyptian|afghani|turkish|arabian|syrian|lebanese|chinese|filipino|indonesian|barbecue|african|malaysian)_restaurant$/,
    30,
    75,
  ],
  [/^(diner|salad_bar|breakfast_and_brunch_restaurant|health_food_restaurant|vegetarian_restaurant|vegan_restaurant)$/, 35, 80],
  [/^seafood_restaurant$/, 60, 140],
  [/^(japanese_restaurant|sushi_restaurant|french_restaurant|steakhouse|asian_fusion_restaurant)$/, 90, 220],
  [/_restaurant$|^restaurant$|^bistro$|^buffet_restaurant$|^theme_restaurant$/, 50, 110],
];

export function costEstimate(p: PriceInput): CostEstimate {
  if (p.priceMin != null || p.priceMax != null) {
    const min = p.priceMin ?? p.priceMax!;
    const max = p.priceMax ?? p.priceMin!;
    return { min, max, planning: Math.round(min + (max - min) * 0.6), basis: min === 0 && max === 0 ? "free" : "verified" };
  }
  if (p.attributes?.free?.value === true) {
    return { min: 0, max: 0, planning: 0, basis: "free" };
  }
  if (p.category === "restaurants" || p.category === "cafes") {
    const sub = p.subcategory ?? (p.category === "cafes" ? "cafe" : "restaurant");
    for (const [re, min, max] of BANDS) {
      if (re.test(sub)) return { min, max, planning: Math.round(min + (max - min) * 0.6), basis: "estimate" };
    }
    return p.category === "cafes"
      ? { min: 15, max: 35, planning: 27, basis: "estimate" }
      : { min: 50, max: 110, planning: 86, basis: "estimate" };
  }
  return { min: null, max: null, planning: null, basis: "unknown" };
}

/** Price level 1–4 derived from a cost band, for "$$" style display. */
export function priceLevelFrom(est: CostEstimate): number | null {
  if (est.basis === "free") return 0;
  if (est.max == null) return null;
  const mid = ((est.min ?? est.max) + est.max) / 2;
  if (mid < 35) return 1;
  if (mid < 80) return 2;
  if (mid < 160) return 3;
  return 4;
}

/* ------------------------------------------------------------------ */
/* Distance & travel                                                    */
/* ------------------------------------------------------------------ */

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type TravelMode = "car" | "ride" | "walk";

export type TravelEstimate = {
  /** Estimated road distance */
  km: number;
  minutes: number;
  basis: "estimate" | "routed";
};

/**
 * Rough travel time without a routing service: straight-line distance
 * times a detour factor, at an average urban speed, plus fixed overheads
 * (parking or waiting for a ride). Always shown as approximate.
 */
export function travelEstimate(from: LatLng, to: LatLng, mode: TravelMode): TravelEstimate {
  const straight = haversineKm(from, to);
  if (mode === "walk") {
    const km = straight * 1.25;
    return { km, minutes: Math.max(1, Math.round((km / 4.5) * 60)), basis: "estimate" };
  }
  const km = straight * 1.35;
  const speed = km < 3 ? 22 : km < 10 ? 32 : 45;
  const overhead = mode === "ride" ? 8 : 5;
  return { km, minutes: Math.round((km / speed) * 60 + overhead), basis: "estimate" };
}

/** Typical time spent at a stop, by category (minutes). */
export function typicalDuration(category: string, subcategory: string | null): number {
  if (subcategory === "movie_theater" || subcategory === "fairgrounds") return 150;
  if (subcategory === "escape_room") return 75;
  if (subcategory === "bowling_alley") return 75;
  if (/scuba|diving/.test(subcategory ?? "")) return 180;
  if (subcategory === "theme_park" || subcategory === "water_park") return 180;
  switch (category) {
    case "cafes":
      return /ice_cream|gelato|yogurt|donut|cupcake|bakery|dessert|chocolatier|juice/.test(subcategory ?? "") ? 30 : 50;
    case "restaurants":
      return /fast_food|sandwich|food_truck/.test(subcategory ?? "") ? 40 : 75;
    case "shopping":
      return 90;
    case "culture":
      return 75;
    case "beaches":
      return 90;
    case "outdoors":
      return 60;
    case "entertainment":
    case "family":
      return 90;
    case "adventure":
      return 120;
    case "sports":
      return 90;
    default:
      return 60;
  }
}
