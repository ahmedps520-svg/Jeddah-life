import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, submissions } from "@/lib/db/schema";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { rankPlaces } from "@/lib/home";

/** Editorial gems carry their type as a "gem:<type>" tag. */
export function gemTypeOf(p: PlaceLite): string | null {
  return p.tags.find((t) => t.startsWith("gem:"))?.slice(4) ?? null;
}

/** Places that became gems through an approved community recommendation. */
export async function communityGemPlaceIds(): Promise<Set<string>> {
  const rows = await db
    .select({ placeId: submissions.placeId })
    .from(submissions)
    .where(and(eq(submissions.status, "approved"), isNotNull(submissions.placeId)));
  return new Set(rows.map((r) => r.placeId!));
}

/** Editors' gems only: community recommendations are listed separately with their own label. */
export function editorialGems(c: Catalog, type: string | null, community: Set<string> = new Set()): PlaceLite[] {
  return rankPlaces(
    c.places.filter((p) => p.gem && p.ver !== "community" && !community.has(p.id) && (!type || gemTypeOf(p) === type)),
    48,
    { perBrand: 1 },
  );
}

export async function gemNotes(ids: string[]) {
  if (!ids.length) return new Map<string, { en: string | null; ar: string | null }>();
  const rows = await db
    .select({ id: places.id, en: places.hiddenGemNoteEn, ar: places.hiddenGemNoteAr })
    .from(places)
    .where(inArray(places.id, ids));
  return new Map(rows.map((r) => [r.id, { en: r.en, ar: r.ar }]));
}

export async function communityGems(type: string | null, limit = 60) {
  return db
    .select({
      id: submissions.id,
      name: submissions.name,
      gemType: submissions.gemType,
      description: submissions.description,
      neighbourhood: submissions.neighbourhood,
      photos: submissions.photos,
    })
    .from(submissions)
    .where(and(eq(submissions.status, "approved"), type ? eq(submissions.gemType, type) : undefined))
    .orderBy(desc(submissions.reviewedAt))
    .limit(limit);
}
