import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, submissions } from "@/lib/db/schema";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { rankPlaces } from "@/lib/home";

/** Editorial gems carry their type as a "gem:<type>" tag. */
export function gemTypeOf(p: PlaceLite): string | null {
  return p.tags.find((t) => t.startsWith("gem:"))?.slice(4) ?? null;
}

export function editorialGems(c: Catalog, type: string | null): PlaceLite[] {
  return rankPlaces(
    c.places.filter((p) => p.gem && (!type || gemTypeOf(p) === type)),
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
