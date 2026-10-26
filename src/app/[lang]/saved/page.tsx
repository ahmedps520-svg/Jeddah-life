import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { Heart, Lock, Globe } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collectionItems, collections, eventSaves, events, itineraries, saves } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { formatDateTime, formatDay, formatMinutes, plural } from "@/lib/i18n/format";
import { PlaceRow, type HoodNames } from "@/components/place/place-card";
import { CoverArt } from "@/components/place/cover-art";
import { EventCard } from "@/components/events/event-card";
import { ButtonLink } from "@/components/ui/button";
import { NewCollectionButton } from "@/components/saved/new-collection";
import { MiniMap } from "@/components/map/mini-map";
import { categoryDef } from "@/lib/taxonomy";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.saved.title, robots: { index: false } };
}

const TABS = ["places", "collections", "outings", "events"] as const;

export default async function SavedPage({ searchParams }: PageProps<"/[lang]/saved">) {
  const { t, locale } = await getDictionary();
  const user = await getCurrentUser();
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab as (typeof TABS)[number]) ? (sp.tab as (typeof TABS)[number]) : "places";

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <Heart className="mx-auto size-10 text-coral-400" />
        <h1 className="mt-4 font-display text-[32px] font-semibold">{t.saved.title}</h1>
        <p className="mt-3 text-ink-600">{t.saved.signInPrompt}</p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href={`/${locale}/auth/sign-up?next=/${locale}/saved`}>{t.auth.signUp}</ButtonLink>
          <ButtonLink href={`/${locale}/auth/sign-in?next=/${locale}/saved`} variant="secondary">
            {t.auth.signIn}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const catalog = await getCatalog();
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const labels = { places: t.saved.places, collections: t.saved.collections, outings: t.saved.itineraries, events: t.saved.events };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <h1 className="font-display text-[34px] font-semibold">{t.saved.title}</h1>
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-sand-300" aria-label={t.saved.title}>
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/${locale}/saved${k === "places" ? "" : `?tab=${k}`}`}
            aria-current={tab === k ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-[15px] font-medium transition ${
              tab === k ? "border-sea-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {labels[k]}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "places" && <SavedPlaces userId={user.id} catalog={catalog} hoods={hoods} />}
        {tab === "collections" && <Collections userId={user.id} catalog={catalog} />}
        {tab === "outings" && <Outings userId={user.id} />}
        {tab === "events" && <SavedEvents userId={user.id} />}
      </div>
    </div>
  );

  async function SavedPlaces({ userId, catalog, hoods }: { userId: string; catalog: Awaited<ReturnType<typeof getCatalog>>; hoods: HoodNames }) {
    const rows = await db.select({ placeId: saves.placeId }).from(saves).where(eq(saves.userId, userId)).orderBy(desc(saves.createdAt));
    const list = rows.map((r) => catalog.byId.get(r.placeId)).filter((p): p is NonNullable<typeof p> => !!p);
    if (!list.length) return <Empty text={t.saved.emptyPlaces} />;
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-1 rounded-3xl bg-white p-2 shadow-card">
          {list.map((p) => (
            <PlaceRow key={p.id} p={p} locale={locale} t={t} hoods={hoods} />
          ))}
        </div>
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <MiniMap
            markers={list.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: categoryDef(p.category).color, href: `/${locale}/place/${p.slug}` }))}
            className="h-80"
            ariaLabel={t.saved.places}
          />
        </div>
      </div>
    );
  }

  async function Collections({ userId, catalog }: { userId: string; catalog: Awaited<ReturnType<typeof getCatalog>> }) {
    const cols = await db.select().from(collections).where(eq(collections.userId, userId)).orderBy(desc(collections.updatedAt));
    const items = cols.length
      ? await db.select().from(collectionItems).where(inArray(collectionItems.collectionId, cols.map((c) => c.id))).orderBy(asc(collectionItems.position))
      : [];
    return (
      <div className="space-y-5">
        <NewCollectionButton />
        {!cols.length && <Empty text={t.saved.emptyCollections} />}
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {cols.map((c) => {
            const its = items.filter((i) => i.collectionId === c.id);
            const places = its.map((i) => catalog.byId.get(i.placeId)).filter((p): p is NonNullable<typeof p> => !!p);
            const cover = places.find((p) => p.img) ?? places[0];
            return (
              <li key={c.id}>
                <Link href={`/${locale}/saved/collections/${c.id}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-ink-800 shadow-card">
                    {cover?.img ? (
                      <Image src={cover.img.url} alt="" fill sizes="(max-width: 768px) 50vw, 320px" className="object-cover transition duration-700 group-hover:scale-105" />
                    ) : (
                      <CoverArt seed={c.id} category={cover?.category ?? "outdoors"} initial={c.name} className="absolute inset-0 size-full" />
                    )}
                    <span className="absolute end-2 top-2 rounded-full bg-ink-950/50 p-1.5 text-white backdrop-blur">
                      {c.isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold">{c.name}</h3>
                  <p className="text-sm text-ink-500">{plural(locale, places.length, t.saved.placesCount)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  async function Outings({ userId }: { userId: string }) {
    const rows = await db.select().from(itineraries).where(eq(itineraries.userId, userId)).orderBy(desc(itineraries.updatedAt));
    if (!rows.length)
      return (
        <div className="space-y-4">
          <Empty text={t.saved.emptyItineraries} />
          <ButtonLink href={`/${locale}/plan`}>{t.home.planCta}</ButtonLink>
        </div>
      );
    return (
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/${locale}/plan/${r.id}`} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-card hover:ring-1 hover:ring-sea-200">
              <div>
                <p className="font-display text-lg font-semibold">{r.title}</p>
                <p className="text-sm text-ink-500">
                  {r.date ? formatDay(locale, r.date, { weekday: "short", year: "numeric" }) : formatDateTime(locale, r.updatedAt)}
                  {" · "}
                  {plural(locale, r.stops.length, t.planner.stops)} · {formatMinutes(locale, r.durationMin)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  async function SavedEvents({ userId }: { userId: string }) {
    const rows = await db
      .select({ e: events })
      .from(eventSaves)
      .innerJoin(events, eq(events.id, eventSaves.eventId))
      .where(eq(eventSaves.userId, userId))
      .orderBy(asc(events.startDate));
    if (!rows.length) return <Empty text={t.saved.emptyEvents} />;
    return (
      <ul className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {rows.map(({ e }) => (
          <li key={e.id}>
            <EventCard
              e={e}
              locale={locale}
              labels={{ free: t.events.free, from: t.events.from, notListed: t.events.priceNotListed, adminManaged: t.events.adminManaged, fromFeed: t.events.fromFeed }}
            />
          </li>
        ))}
      </ul>
    );
  }
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-3xl bg-white p-8 text-center text-ink-500 shadow-card">{text}</p>;
}
