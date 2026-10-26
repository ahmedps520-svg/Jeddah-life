import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { collectionItems, collections, users } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import { MiniMap } from "@/components/map/mini-map";
import { categoryDef } from "@/lib/taxonomy";
import { plural } from "@/lib/i18n/format";

export const metadata: Metadata = { robots: { index: false } };

/** Read-only view of a collection its owner chose to share. */
export default async function SharedCollectionPage({ params }: PageProps<"/[lang]/c/[token]">) {
  const { t, locale } = await getDictionary();
  const { token } = await params;
  const [row] = await db
    .select({ c: collections, owner: users.displayName, ownerPublic: users.privacy })
    .from(collections)
    .innerJoin(users, eq(users.id, collections.userId))
    .where(eq(collections.shareToken, token));
  if (!row || !row.c.isPublic) {
    return <p className="mx-auto max-w-xl px-4 py-16 text-center text-ink-600">{t.saved.notFoundShared}</p>;
  }
  const items = await db.select().from(collectionItems).where(eq(collectionItems.collectionId, row.c.id)).orderBy(asc(collectionItems.position));
  const catalog = await getCatalog();
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const places = items.map((i) => catalog.byId.get(i.placeId)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6 md:py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t.saved.sharedBy}</p>
        <h1 className="mt-1 font-display text-[36px] font-semibold">{row.c.name}</h1>
        {row.c.description && <p className="mt-2 max-w-prose text-ink-600">{row.c.description}</p>}
        <p className="mt-2 text-sm text-ink-500">
          {plural(locale, places.length, t.saved.placesCount)}
          {row.ownerPublic?.profilePublic ? ` · ${row.owner}` : ""}
        </p>
      </header>
      {places.length > 0 && (
        <MiniMap
          markers={places.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, n: i + 1, color: categoryDef(p.category).color, href: `/${locale}/place/${p.slug}` }))}
          className="h-80"
          ariaLabel={t.saved.mapOfCollection}
        />
      )}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {places.map((p) => (
          <li key={p.id}>
            <PlaceCard p={p} locale={locale} t={t} hoods={hoods} size="grid" />
          </li>
        ))}
      </ul>
    </div>
  );
}
