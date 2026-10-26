import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collectionItems, collections } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { CollectionEditor } from "@/components/saved/collection-editor";
import type { HoodNames } from "@/components/place/place-card";

export const metadata: Metadata = { robots: { index: false } };

export default async function CollectionPage({ params }: PageProps<"/[lang]/saved/collections/[id]">) {
  const { locale } = await getDictionary();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/sign-in?next=/${locale}/saved/collections/${id}`);
  const [col] = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.userId, user.id)));
  if (!col) notFound();
  const items = await db.select().from(collectionItems).where(eq(collectionItems.collectionId, id)).orderBy(asc(collectionItems.position));
  const catalog = await getCatalog();
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const places = items.map((i) => catalog.byId.get(i.placeId)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <CollectionEditor col={{ id: col.id, name: col.name, description: col.description, isPublic: col.isPublic, shareToken: col.shareToken }} places={places} hoods={hoods} />
    </div>
  );
}
