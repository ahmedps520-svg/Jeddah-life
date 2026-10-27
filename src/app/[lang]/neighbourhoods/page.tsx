import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { localized, plural } from "@/lib/i18n/format";
import { CoverArt } from "@/components/place/cover-art";
import { MiniMap } from "@/components/map/mini-map";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.hoods.title, description: t.hoods.lede };
}

/** Areas with fewer listed places than this are left out of the A–Z list. */
const MIN_PLACES = 5;

export default async function NeighbourhoodsPage() {
  const { t, locale } = await getDictionary();
  const catalog = await getCatalog();
  const rows = await db
    .select({
      slug: neighbourhoods.slug,
      introEn: neighbourhoods.introEn,
      introAr: neighbourhoods.introAr,
      hero: neighbourhoods.hero,
      featured: neighbourhoods.featured,
      sortOrder: neighbourhoods.sortOrder,
    })
    .from(neighbourhoods)
    .orderBy(asc(neighbourhoods.sortOrder));

  const counts = new Map<string, number>();
  for (const p of catalog.places) if (p.hood) counts.set(p.hood, (counts.get(p.hood) ?? 0) + 1);
  const name = (slug: string) => {
    const h = catalog.hoodBySlug.get(slug);
    return h ? (locale === "ar" ? h.nameAr || h.nameEn : h.nameEn) : slug;
  };
  const guides = rows.filter((r) => r.featured && r.introEn);
  const all = catalog.hoods
    .filter((h) => (counts.get(h.slug) ?? 0) >= MIN_PLACES)
    .sort((a, b) => name(a.slug).localeCompare(name(b.slug), locale === "ar" ? "ar" : "en"));
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="max-w-3xl">
        <h1 className="font-display text-[38px] font-semibold leading-tight md:text-[48px]">{t.hoods.title}</h1>
        <p className="mt-3 text-lg text-ink-600">{t.hoods.lede}</p>
      </header>

      {guides.length > 0 && (
        <section className="mt-10" aria-labelledby="guides-title">
          <h2 id="guides-title" className="font-display text-2xl font-semibold">
            {t.hoods.guides}
          </h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g, i) => (
              <li key={g.slug} className="min-w-0">
                <Link href={`/${locale}/neighbourhoods/${g.slug}`} className="group block overflow-hidden rounded-3xl bg-white shadow-card transition hover:shadow-lift">
                  <div className="relative aspect-[16/10] overflow-hidden bg-ink-900">
                    {g.hero ? (
                      <Image src={g.hero.url} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" priority={i < 2} className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                    ) : (
                      <CoverArt seed={g.slug} category="hoods" initial={name(g.slug)} className="absolute inset-0 size-full" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="font-display text-2xl font-semibold">{name(g.slug)}</p>
                      <p className="mt-1 text-sm text-white/80">{plural(locale, counts.get(g.slug) ?? 0, t.hoods.placesHere)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-5">
                    <p className="line-clamp-3 flex-1 text-[15px] text-ink-600">{localized(locale, g.introEn, g.introAr)}</p>
                    <Arrow className="mt-1 size-5 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_420px]" aria-labelledby="all-title">
        <div className="min-w-0">
          <h2 id="all-title" className="font-display text-2xl font-semibold">
            {t.hoods.allAreas}
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {all.map((h) => (
              <li key={h.slug} className="min-w-0">
                <Link
                  href={`/${locale}/neighbourhoods/${h.slug}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-200 transition hover:ring-ink-300"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-sea-600" />
                    <span className="truncate font-medium">{name(h.slug)}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-ink-500">{plural(locale, counts.get(h.slug) ?? 0, t.hoods.placesHere)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <MiniMap
            className="h-80 lg:h-[520px]"
            ariaLabel={t.hoods.title}
            markers={catalog.hoods
              .filter((h) => (counts.get(h.slug) ?? 0) >= MIN_PLACES)
              .map((h) => ({
                id: h.slug,
                lat: h.center[0],
                lng: h.center[1],
                color: h.featured ? "#B84A62" : "#2C7A7B",
                label: name(h.slug),
                href: `/${locale}/neighbourhoods/${h.slug}`,
              }))}
          />
          <p className="mt-2 text-xs text-ink-500">{t.hoods.boundarySource}</p>
        </div>
      </section>
    </div>
  );
}
