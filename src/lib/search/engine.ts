import "server-only";
import type { Catalog, SearchDoc } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { haversineKm, type LatLng } from "@/lib/places/estimates";
import { cityWallAt, cityWallNow, openDuring } from "@/lib/places/hours";
import { parseQuery, emptyQuery, type Attr, type ParsedQuery } from "./parse";
import { skeletons, tokenize } from "./normalize";
import { cityToday } from "@/lib/i18n/format";

export type SortKey = "relevance" | "distance" | "price" | "rating" | "popularity";

export type SearchOptions = {
  q?: string;
  /** Pre-parsed query (e.g. from the AI interpreter) */
  parsed?: ParsedQuery;
  /** Parsed facets the user removed from the "we understood" chips */
  ignore?: string[];
  category?: string | null;
  hood?: string | null;
  maxPrice?: number | null;
  free?: boolean;
  openNow?: boolean;
  minRating?: number | null;
  attrs?: Attr[];
  hideChains?: boolean;
  verifiedOnly?: boolean;
  origin?: LatLng | null;
  radiusKm?: number | null;
  sort?: SortKey;
  limit?: number;
  offset?: number;
  /** Limit to these ids (collections / map bounds) */
  ids?: string[];
};

export type SearchHit = PlaceLite & { distanceKm: number | null; score: number };

export type SearchResult = {
  total: number;
  hits: SearchHit[];
  parsed: ParsedQuery;
  relaxed: boolean;
  /** Results shown without listed hours while a time filter was active */
  noHoursCount: number;
  sortFallback: boolean;
};

const SUB_GROUPS: Record<string, RegExp> = {
  ice_cream: /^(ice_cream_shop|gelato_shop|frozen_yogurt_shop)$/,
  dessert: /^(dessert_shop|donut_shop|cupcake_shop|chocolatier|bakery|ice_cream_shop|gelato_shop|frozen_yogurt_shop)$/,
  breakfast: /^(breakfast_and_brunch_restaurant|bakery|pancake_house)$/,
  seafood: /^(seafood_restaurant|fish_and_chips_restaurant)$/,
  burger: /^burger_restaurant$/,
  pizza: /^pizza_restaurant$/,
  japanese: /^(japanese_restaurant|sushi_restaurant|ramen_restaurant)$/,
  italian: /^italian_restaurant$/,
  indian: /^(indian_restaurant|pakistani_restaurant|bangladeshi_restaurant)$/,
  arab: /^(middle_eastern_restaurant|lebanese_restaurant|syrian_restaurant|arabian_restaurant|turkish_restaurant|egyptian_restaurant|yemeni_restaurant|doner_kebab_restaurant)$/,
  grill: /^(barbecue_restaurant|steakhouse)$/,
  fast_food: /^(fast_food_restaurant|sandwich_shop|chicken_restaurant)$/,
  cinema: /^(movie_theater|fairgrounds)$/,
  games: /^(escape_room|bowling_alley|arcade|comedy_club|pool_billiards)$/,
};

const ACTIVITY_CATEGORIES = ["entertainment", "adventure", "family", "culture", "outdoors", "beaches", "sports", "shopping"];
const HARD_ATTRS: Attr[] = ["family", "indoor", "outdoor", "wheelchair", "late", "photo"];

export function inCategory(p: PlaceLite, c: string): boolean {
  if (c === "nightlife") return p.late || p.secondary.includes("nightlife");
  if (c === "family") return p.category === "family" || p.secondary.includes("family") || p.attrs.family === true;
  if (c === "hidden-gems") return p.gem;
  return p.category === c || p.secondary.includes(c);
}

function hasAttr(p: PlaceLite, a: Attr): boolean {
  if (a === "late") return p.late || p.secondary.includes("nightlife");
  const key = a === "photo" ? "photo" : a;
  return (p.attrs as Record<string, boolean | undefined>)[key] === true;
}

function textScore(doc: SearchDoc, tokens: string[], joined: string): { score: number; matched: number } {
  let score = 0;
  let matched = 0;
  for (const t of tokens) {
    let s = 0;
    if (doc.name.has(t)) s = 40;
    else if (t.length >= 3 && [...doc.name].some((n) => n.startsWith(t))) s = 26;
    else if (doc.other.has(t)) s = 16;
    else if (t.length >= 3 && [...doc.other].some((n) => n.startsWith(t))) s = 9;
    else if (t.length >= 4 && skeletons(t).some((sk) => doc.skel.has(sk))) s = 12;
    if (s > 0) matched++;
    score += s;
  }
  if (joined && doc.nameJoined.some((n) => n === joined)) score += 60;
  else if (joined.length >= 3 && doc.nameJoined.some((n) => n.startsWith(joined))) score += 25;
  return { score, matched };
}

function qualityScore(p: PlaceLite): number {
  let s = 0;
  if (p.ver === "verified") s += 6;
  if (p.pick) s += 6;
  if (p.img) s += 4;
  if (p.hasDescription) s += 3;
  if (p.gem) s += 2;
  if (p.chain) s -= 4;
  s += Math.min(8, Math.log2(1 + p.pop + p.saves * 2));
  if (p.rating != null && p.reviews >= 2) s += (p.rating - 3) * 3;
  return s;
}

/** Date + time window to check for "tonight"/"weekend"/weekday queries. */
function timeWindows(parsed: ParsedQuery): Date[] {
  if (!parsed.when) return [];
  const today = cityToday();
  const now = cityWallNow();
  const dayOffset = (target: number) => (target - now.getDay() + 7) % 7;
  const at = (offset: number, time: string) => {
    const d = new Date(Date.parse(today + "T00:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
    return cityWallAt(d, time);
  };
  switch (parsed.when.kind) {
    case "tonight":
      return [at(0, "20:00")];
    case "today":
      return [at(0, now.getHours() < 17 ? "17:00" : `${String(Math.min(22, now.getHours() + 1)).padStart(2, "0")}:00`)];
    case "weekend":
      return [at(dayOffset(5), "17:00"), at(dayOffset(6), "17:00")];
    case "day":
      return [at(dayOffset(parsed.when.weekday ?? 5), "17:00")];
  }
}

export async function searchPlaces(catalog: Catalog, opts: SearchOptions): Promise<SearchResult> {
  const parsed = opts.parsed ?? (opts.q ? parseQuery(opts.q, catalog.hoodVocab) : emptyQuery());
  const ignore = new Set(opts.ignore ?? []);
  const keep = (key: string) => !ignore.has(key);

  const categories = [
    ...(opts.category ? [opts.category] : []),
    ...parsed.categories.filter((c) => keep(`category:${c}`)),
  ];
  const subs = parsed.subs.filter((s) => keep(`sub:${s}`));
  const hoods = [...(opts.hood ? [opts.hood] : []), ...parsed.hoods.filter((h) => keep(`hood:${h}`))];
  const maxPrice = [opts.maxPrice ?? null, keep("maxPrice") ? parsed.maxPrice : null].filter((v): v is number => v != null);
  const free = !!opts.free || (parsed.free && keep("free"));
  const minLevel = keep("upscale") ? parsed.minLevel : null;
  const openNow = !!opts.openNow || (parsed.openNow && keep("openNow"));
  const attrs = [...new Set([...(opts.attrs ?? []), ...parsed.attrs.filter((a) => keep(`attr:${a}`))])];
  const waterfront = parsed.waterfront && keep("waterfront");
  const activities = parsed.activities && keep("activities");
  const occasions = parsed.occasions.filter((o) => keep(`occasion:${o}`));
  const windows = keep("when") ? timeWindows(parsed) : [];
  const origin = opts.origin ?? null;

  const idSet = opts.ids ? new Set(opts.ids) : null;
  const tokens = parsed.text;
  const joined = tokenize(opts.q ?? "").join(" ");

  const scoreAll = (relaxed: boolean) => {
    const out: SearchHit[] = [];
    let noHours = 0;
    for (const doc of catalog.docs) {
      const p = doc.p;
      if (idSet && !idSet.has(p.id)) continue;
      if (categories.length && !categories.some((c) => inCategory(p, c))) continue;
      if (!categories.length && activities && !ACTIVITY_CATEGORIES.some((c) => inCategory(p, c))) continue;
      if (!categories.length && occasions.includes("birthday") && !["restaurants", "entertainment", "family", "adventure", "cafes"].some((c) => inCategory(p, c))) continue;
      if (subs.length && !subs.some((s) => SUB_GROUPS[s]?.test(p.sub ?? ""))) continue;
      if (hoods.length && !hoods.includes(p.hood ?? "")) continue;
      if (free && p.cost.basis !== "free") continue;
      if (maxPrice.length) {
        const cap = Math.min(...maxPrice);
        if (p.cost.planning == null || p.cost.planning > cap) continue;
      }
      if (minLevel != null && (p.level == null || p.level < minLevel)) continue;
      if (openNow && p.open !== "open") continue;
      if (opts.minRating && (p.rating == null || p.rating < opts.minRating)) continue;
      if (opts.hideChains && p.chain) continue;
      if (opts.verifiedOnly && p.ver !== "verified") continue;
      if (attrs.some((a) => HARD_ATTRS.includes(a) && !hasAttr(p, a))) continue;
      if (waterfront && doc.coastKm > 1.2) continue;

      const distanceKm = origin ? haversineKm(origin, p) : null;
      if (opts.radiusKm && distanceKm != null && distanceKm > opts.radiusKm) continue;

      // Time windows: exclude places whose listed hours say they're closed.
      let timeBoost = 0;
      if (windows.length) {
        const hours = catalog.hours.get(p.id);
        if (hours) {
          const ok = windows.some((w) => openDuring(hours, w, 60) === true);
          if (!ok) continue;
          timeBoost = 8;
        } else {
          noHours++;
        }
      }

      let score = qualityScore(p) + timeBoost;
      if (tokens.length) {
        const t = textScore(doc, tokens, joined);
        if (relaxed ? t.matched === 0 : t.matched < tokens.length) continue;
        score += t.score;
      }
      for (const a of attrs) if (!HARD_ATTRS.includes(a) && hasAttr(p, a)) score += 8;
      if (occasions.length && p.occasions.some((o) => occasions.includes(o))) score += 10;
      if (waterfront) score += Math.max(0, 6 - doc.coastKm * 5);
      if (parsed.nearMe && distanceKm != null) score += Math.max(0, 10 - distanceKm);
      out.push({ ...p, distanceKm, score });
    }
    return { out, noHours };
  };

  let relaxed = false;
  let { out, noHours } = scoreAll(false);
  if (!out.length && tokens.length > 1) {
    relaxed = true;
    ({ out, noHours } = scoreAll(true));
  }

  let sort: SortKey = opts.sort ?? (parsed.nearMe && origin ? "distance" : "relevance");
  let sortFallback = false;
  if (sort === "distance" && !origin) {
    sort = "relevance";
    sortFallback = true;
  }
  const byScore = (a: SearchHit, b: SearchHit) => b.score - a.score || a.slug.localeCompare(b.slug);
  switch (sort) {
    case "distance":
      out.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
      break;
    case "price": {
      const v = (h: SearchHit) => (h.cost.planning == null ? Number.POSITIVE_INFINITY : h.cost.planning);
      out.sort((a, b) => v(a) - v(b) || byScore(a, b));
      break;
    }
    case "rating":
      out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviews - a.reviews || byScore(a, b));
      break;
    case "popularity":
      out.sort((a, b) => b.pop + b.saves * 3 - (a.pop + a.saves * 3) || byScore(a, b));
      break;
    default:
      out.sort(byScore);
      diversify(out);
  }

  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 24;
  return { total: out.length, hits: out.slice(offset, offset + limit), parsed, relaxed, noHoursCount: noHours, sortFallback };
}

/** Avoid a wall of the same chain at the top of relevance results. */
function diversify(list: SearchHit[]) {
  const seen = new Map<string, number>();
  const head = list.slice(0, 60);
  for (const h of head) {
    if (!h.brand) continue;
    const n = seen.get(h.brand) ?? 0;
    if (n > 0) h.score -= 15 * n;
    seen.set(h.brand, n + 1);
  }
  head.sort((a, b) => b.score - a.score);
  list.splice(0, head.length, ...head);
}

