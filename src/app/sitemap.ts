import type { MetadataRoute } from "next";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { PLACE_CATEGORIES } from "@/lib/taxonomy";
import { cityToday } from "@/lib/i18n/format";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const catalog = await getCatalog();
  const both = (path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap =>
    (["en", "ar"] as const).map((l) => ({
      url: `${base}/${l}${path}`,
      alternates: { languages: { en: `${base}/en${path}`, ar: `${base}/ar${path}` } },
      ...extra,
    }));
  const counts = new Map<string, number>();
  for (const p of catalog.places) if (p.hood) counts.set(p.hood, (counts.get(p.hood) ?? 0) + 1);
  const upcoming = await db
    .select({ slug: events.slug, updatedAt: events.updatedAt })
    .from(events)
    .where(and(eq(events.status, "published"), gte(events.endDate, cityToday())));

  return [
    ...["", "/explore", "/map", "/events", "/neighbourhoods", "/hidden-gems", "/plan", "/make-it-happen", "/together", "/about"].flatMap((p) => both(p)),
    ...PLACE_CATEGORIES.flatMap((c) => both(`/category/${c.slug}`)),
    ...catalog.hoods.filter((h) => h.featured || (counts.get(h.slug) ?? 0) >= 5).flatMap((h) => both(`/neighbourhoods/${h.slug}`)),
    ...upcoming.flatMap((e) => both(`/events/${e.slug}`, { lastModified: e.updatedAt })),
    ...catalog.places.flatMap((p) => both(`/place/${p.slug}`)),
  ];
}
