import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, heroSlides, submissions } from "@/lib/db/schema";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { inCategory } from "@/lib/search/engine";
import { cityToday } from "@/lib/i18n/format";

/** Shared ranking for editorial-style rails: quality first, then variety. */
export function rankPlaces(list: PlaceLite[], limit: number, opts: { perBrand?: number; perCategory?: number } = {}): PlaceLite[] {
  const q = (p: PlaceLite) =>
    (p.ver === "verified" ? 8 : 0) +
    (p.pick ? 6 : 0) +
    (p.img ? 6 : 0) +
    (p.hasDescription ? 4 : 0) +
    (p.chain ? -10 : 0) +
    Math.min(6, Math.log2(1 + p.pop + p.saves)) +
    (p.rating != null && p.reviews >= 2 ? (p.rating - 3) * 2 : 0);
  const sorted = [...list].sort((a, b) => q(b) - q(a) || a.slug.localeCompare(b.slug));
  const out: PlaceLite[] = [];
  const brands = new Map<string, number>();
  const cats = new Map<string, number>();
  for (const p of sorted) {
    if (p.brand && (brands.get(p.brand) ?? 0) >= (opts.perBrand ?? 1)) continue;
    if (opts.perCategory && (cats.get(p.category) ?? 0) >= opts.perCategory) continue;
    if (p.brand) brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1);
    cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export function trending(c: Catalog): PlaceLite[] {
  // Only real activity from the last 7 days counts as trending.
  const active = c.places.filter((p) => p.pop > 0);
  if (active.length < 4) return [];
  return [...active].sort((a, b) => b.pop - a.pop).slice(0, 12);
}

export function editorsPicks(c: Catalog): PlaceLite[] {
  return rankPlaces(c.places.filter((p) => p.pick), 12, { perCategory: 4 });
}

export function worthVisiting(c: Catalog): PlaceLite[] {
  return rankPlaces(
    c.places.filter((p) => p.ver === "verified" && ["culture", "outdoors", "beaches", "entertainment", "family", "shopping"].includes(p.category)),
    12,
    { perCategory: 3 },
  );
}

export function under50(c: Catalog): PlaceLite[] {
  return rankPlaces(
    c.places.filter((p) => p.cost.planning != null && p.cost.planning <= 50 && !p.chain),
    12,
    { perCategory: 3 },
  );
}

export function weekend(c: Catalog): PlaceLite[] {
  return rankPlaces(
    c.places.filter((p) => p.attrs.groups === true && ["entertainment", "adventure", "beaches", "outdoors", "family", "culture"].includes(p.category)),
    12,
    { perCategory: 3 },
  );
}

export function familyFriendly(c: Catalog): PlaceLite[] {
  return rankPlaces(c.places.filter((p) => inCategory(p, "family")), 12, { perCategory: 3 });
}

export function newPlaces(c: Catalog): PlaceLite[] {
  const cutoff = Date.now() - 60 * 86400000;
  const recent = c.places.filter((p) => p.added >= cutoff && !p.chain);
  // Most recently added first, but skip bare listings so the rail is worth browsing.
  return [...recent]
    .filter((p) => p.img || p.hasDescription || p.ver === "verified" || p.category !== "restaurants")
    .sort((a, b) => b.added - a.added || (b.img ? 1 : 0) - (a.img ? 1 : 0))
    .slice(0, 12);
}

export function hiddenGemPlaces(c: Catalog): PlaceLite[] {
  return rankPlaces(c.places.filter((p) => p.gem), 12);
}

export function categoryCover(c: Catalog, slug: string): PlaceLite | null {
  const withImg = c.places.filter((p) => p.img && inCategory(p, slug));
  return rankPlaces(withImg, 1)[0] ?? null;
}

export function categoryCount(c: Catalog, slug: string): number {
  return c.places.filter((p) => inCategory(p, slug)).length;
}

export async function getHeroSlides() {
  try {
    return await db.select().from(heroSlides).where(eq(heroSlides.active, true)).orderBy(asc(heroSlides.sortOrder));
  } catch {
    return [];
  }
}

export async function upcomingEvents(limit = 10) {
  const today = cityToday();
  return db
    .select()
    .from(events)
    .where(and(eq(events.status, "published"), gte(events.endDate, today)))
    .orderBy(asc(events.startDate))
    .limit(limit);
}

export async function approvedGemSubmissions(limit = 12) {
  return db
    .select()
    .from(submissions)
    .where(eq(submissions.status, "approved"))
    .orderBy(asc(submissions.createdAt))
    .limit(limit);
}
