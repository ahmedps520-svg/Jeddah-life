import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods, placeStats, places, reviews, saves, type Place } from "@/lib/db/schema";
import { costEstimate, haversineKm, priceLevelFrom, type LatLng } from "./estimates";
import { openStatus, opensLate } from "./hours";
import type { NeighbourhoodLite, PlaceLite } from "./types";
import { HOOD_DISPLAY, FEATURED_HOODS } from "./hood-aliases";
import { CATEGORIES, OUTDOORS, SUBCATEGORIES } from "@/lib/taxonomy";
import { skeletons, stripArabicArticle, tokenize } from "@/lib/search/normalize";
import type { HoodVocab } from "@/lib/search/parse";
import { buildHoodVocab } from "@/lib/search/hood-vocab";
import { cityToday } from "@/lib/i18n/format";

/**
 * In-memory catalogue of published places used by search, the map,
 * carousels, recommendations and the planner. Rebuilt at most once a
 * minute (so "open now" and popularity stay fresh) and immediately after
 * editors or users change something via invalidateCatalog().
 */

export type SearchDoc = {
  p: PlaceLite;
  name: Set<string>;
  nameJoined: string[];
  other: Set<string>;
  skel: Set<string>;
  coastKm: number;
};

export type Catalog = {
  places: PlaceLite[];
  byId: Map<string, PlaceLite>;
  bySlug: Map<string, PlaceLite>;
  docs: SearchDoc[];
  hoods: NeighbourhoodLite[];
  hoodBySlug: Map<string, NeighbourhoodLite>;
  hoodVocab: HoodVocab[];
  /** OSM opening_hours strings for places that list them */
  hours: Map<string, string>;
  builtAt: number;
};

const TTL_MS = 60_000;
const g = globalThis as unknown as { __jlCatalog?: Promise<Catalog>; __jlCatalogAt?: number };

export function invalidateCatalog() {
  g.__jlCatalog = undefined;
  g.__jlCatalogAt = 0;
}

export async function getCatalog(): Promise<Catalog> {
  const fresh = g.__jlCatalog && g.__jlCatalogAt && Date.now() - g.__jlCatalogAt < TTL_MS;
  if (!fresh) {
    g.__jlCatalogAt = Date.now();
    g.__jlCatalog = build().catch((err) => {
      g.__jlCatalog = undefined;
      throw err;
    });
  }
  return g.__jlCatalog!;
}

function attrValue(p: Place, key: keyof Place["attributes"]): boolean | undefined {
  const a = p.attributes?.[key];
  return a && a.value !== null ? a.value : undefined;
}

export function toLite(
  p: Place,
  extra: { rating: number | null; reviews: number; saves: number; pop: number },
): PlaceLite {
  const cost = costEstimate(p);
  const img = p.images?.[0];
  return {
    id: p.id,
    slug: p.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    category: p.category,
    secondary: p.secondaryCategories ?? [],
    sub: p.subcategory,
    lat: p.lat,
    lng: p.lng,
    hood: p.neighbourhood,
    img: img ? { url: img.url, w: img.width, h: img.height, author: img.author ?? null, license: img.license ?? null } : null,
    cost: { min: cost.min, max: cost.max, planning: cost.planning, basis: cost.basis },
    level: p.priceLevel ?? priceLevelFrom(cost),
    attrs: {
      family: attrValue(p, "familyFriendly"),
      indoor: attrValue(p, "indoor"),
      outdoor: attrValue(p, "outdoor"),
      free: attrValue(p, "free"),
      groups: attrValue(p, "groups"),
      wheelchair: attrValue(p, "wheelchair"),
      photo: attrValue(p, "photoSpot"),
      romantic: attrValue(p, "romantic"),
      quiet: attrValue(p, "quiet"),
    },
    open: p.openingHours ? (openStatus(p.openingHours)?.state ?? null) : null,
    late: opensLate(p.openingHours),
    hasHours: !!p.openingHours,
    ver: p.verification,
    pick: p.editorsPick,
    gem: p.hiddenGem,
    chain: p.isChain,
    brand: p.brand,
    rating: extra.rating,
    reviews: extra.reviews,
    saves: extra.saves,
    pop: extra.pop,
    added: p.createdAt.getTime(),
    tags: p.tags ?? [],
    occasions: p.occasions ?? [],
    hasDescription: !!(p.descriptionEn || p.descriptionAr),
  };
}

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  return cityToday(d);
}

async function build(): Promise<Catalog> {
  const [rows, ratingRows, saveRows, popRows, hoodRows] = await Promise.all([
    db.select().from(places).where(eq(places.status, "published")),
    db
      .select({ placeId: reviews.placeId, avg: sql<number>`avg(${reviews.rating})`, n: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.status, "published"))
      .groupBy(reviews.placeId),
    db.select({ placeId: saves.placeId, n: sql<number>`count(*)` }).from(saves).groupBy(saves.placeId),
    db
      .select({
        placeId: placeStats.placeId,
        score: sql<number>`sum(${placeStats.views} + 3 * ${placeStats.saves} + 2 * ${placeStats.plans})`,
      })
      .from(placeStats)
      .where(and(gte(placeStats.day, daysAgo(7))))
      .groupBy(placeStats.placeId),
    db.select().from(neighbourhoods),
  ]);

  const ratingMap = new Map(ratingRows.map((r) => [r.placeId, { avg: Number(r.avg), n: Number(r.n) }]));
  const saveMap = new Map(saveRows.map((r) => [r.placeId, Number(r.n)]));
  const popMap = new Map(popRows.map((r) => [r.placeId, Number(r.score)]));

  const hoods: NeighbourhoodLite[] = hoodRows.map((h) => ({
    slug: h.slug,
    nameEn: HOOD_DISPLAY[h.slug]?.en ?? h.nameEn,
    nameAr: HOOD_DISPLAY[h.slug]?.ar ?? h.nameAr,
    center: [h.centerLat, h.centerLng],
    featured: h.featured || FEATURED_HOODS.includes(h.slug),
  }));
  hoods.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  const hoodBySlug = new Map(hoods.map((h) => [h.slug, h]));

  const hoodVocab: HoodVocab[] = buildHoodVocab(hoods);

  const placesLite = rows.map((p) => {
    const r = ratingMap.get(p.id);
    return toLite(p, {
      rating: r && r.n > 0 ? Math.round(r.avg * 10) / 10 : null,
      reviews: r?.n ?? 0,
      saves: saveMap.get(p.id) ?? 0,
      pop: popMap.get(p.id) ?? 0,
    });
  });

  const waterfront: LatLng[] = placesLite
    .filter((p) => p.category === "beaches" || p.sub === "waterfront" || p.sub === "marina" || p.sub === "beach")
    .map((p) => ({ lat: p.lat, lng: p.lng }));

  const catLabels = new Map<string, string[]>();
  for (const c of [...CATEGORIES, OUTDOORS]) catLabels.set(c.slug, [...tokenize(c.name.en), ...tokenize(c.name.ar)]);

  const docs: SearchDoc[] = placesLite.map((p) => {
    const nameTokens = [...tokenize(p.nameEn ?? ""), ...tokenize(p.nameAr ?? "")];
    const other = new Set<string>();
    for (const c of [p.category, ...p.secondary]) catLabels.get(c)?.forEach((t) => other.add(t));
    const subLabel = p.sub ? SUBCATEGORIES[p.sub] : null;
    if (subLabel) [...tokenize(subLabel.en), ...tokenize(subLabel.ar)].forEach((t) => other.add(t));
    const hood = p.hood ? hoodBySlug.get(p.hood) : null;
    if (hood) [...tokenize(hood.nameEn), ...tokenize(hood.nameAr ?? "")].forEach((t) => other.add(t));
    for (const tag of p.tags) tokenize(tag).forEach((t) => other.add(t));
    const skel = new Set<string>();
    for (const t of nameTokens) if (t.length >= 4) skeletons(t).forEach((s) => skel.add(s));
    const coastKm = waterfront.length
      ? Math.min(...waterfront.map((w) => haversineKm(w, { lat: p.lat, lng: p.lng })))
      : Number.POSITIVE_INFINITY;
    return {
      p,
      name: new Set(nameTokens.map(stripArabicArticle)),
      nameJoined: [tokenize(p.nameEn ?? "").join(" "), tokenize(p.nameAr ?? "").join(" ")].filter(Boolean),
      other,
      skel,
      coastKm,
    };
  });

  return {
    places: placesLite,
    byId: new Map(placesLite.map((p) => [p.id, p])),
    bySlug: new Map(placesLite.map((p) => [p.slug, p])),
    docs,
    hoods,
    hoodBySlug,
    hoodVocab,
    hours: new Map(rows.filter((r) => r.openingHours).map((r) => [r.id, r.openingHours!])),
    builtAt: Date.now(),
  };
}
