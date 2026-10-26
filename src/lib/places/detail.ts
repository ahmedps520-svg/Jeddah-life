import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { placeNotes, places, reviews, users, visits, type Place } from "@/lib/db/schema";
import type { Catalog } from "./catalog";
import type { PlaceLite } from "./types";
import { haversineKm } from "./estimates";

export async function getPlace(slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<Place | null> {
  const [row] = await db.select().from(places).where(eq(places.slug, slug)).limit(1);
  if (!row) return null;
  if (row.status !== "published" && !opts.includeUnpublished) return null;
  return row;
}

export type ReviewView = {
  id: string;
  rating: number;
  body: string;
  visitDate: string | null;
  priceAssessment: string | null;
  spentPerPerson: number | null;
  photos: { url: string }[];
  createdAt: Date;
  updatedAt: Date;
  author: string;
  authorId: string;
};

export async function getReviews(placeId: string): Promise<ReviewView[]> {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      visitDate: reviews.visitDate,
      priceAssessment: reviews.priceAssessment,
      spentPerPerson: reviews.spentPerPerson,
      photos: reviews.photos,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      author: users.displayName,
      authorId: users.id,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(and(eq(reviews.placeId, placeId), eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt))
    .limit(100);
  return rows.map((r) => ({ ...r, photos: (r.photos ?? []).map((p) => ({ url: p.url })) }));
}

export async function getPersonal(userId: string, placeId: string) {
  const [[note], [visit], [review]] = await Promise.all([
    db.select().from(placeNotes).where(and(eq(placeNotes.userId, userId), eq(placeNotes.placeId, placeId))),
    db.select().from(visits).where(and(eq(visits.userId, userId), eq(visits.placeId, placeId))),
    db.select().from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.placeId, placeId))),
  ]);
  return { note: note?.body ?? "", visited: !!visit, review: review ?? null };
}

/** "You might also like": same kind of place, nearby, similar price — never the same chain. */
export function similarPlaces(catalog: Catalog, p: PlaceLite, limit = 10): PlaceLite[] {
  const scored: Array<{ x: PlaceLite; s: number }> = [];
  for (const x of catalog.places) {
    if (x.id === p.id) continue;
    if (p.brand && x.brand === p.brand) continue;
    let s = 0;
    if (x.category === p.category) s += 6;
    else if (x.secondary.includes(p.category) || p.secondary.includes(x.category)) s += 3;
    else continue;
    if (x.sub && x.sub === p.sub) s += 4;
    if (x.hood && x.hood === p.hood) s += 3;
    const d = haversineKm(p, x);
    if (d < 1) s += 3;
    else if (d < 3) s += 2;
    else if (d > 12) s -= 2;
    if (p.level != null && x.level != null) s += Math.max(0, 2 - Math.abs(p.level - x.level));
    if (x.ver === "verified") s += 2;
    if (x.img) s += 2;
    if (x.chain) s -= 3;
    scored.push({ x, s });
  }
  scored.sort((a, b) => b.s - a.s);
  const out: PlaceLite[] = [];
  const brands = new Set<string>();
  for (const { x } of scored) {
    if (x.brand) {
      if (brands.has(x.brand)) continue;
      brands.add(x.brand);
    }
    out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}

/** Nearest other branches of the same chain. */
export function otherBranches(catalog: Catalog, p: PlaceLite, limit = 6): Array<PlaceLite & { km: number }> {
  if (!p.brand) return [];
  return catalog.places
    .filter((x) => x.brand === p.brand && x.id !== p.id)
    .map((x) => ({ ...x, km: haversineKm(p, x) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
