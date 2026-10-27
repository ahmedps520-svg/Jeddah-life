import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass, Footprints, Info, Map as MapIcon, Route } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/places/catalog";
import { getNeighbourhood, hoodSections, mapHighlights, placesIn, walkingRoute } from "@/lib/neighbourhoods";
import { fmt, formatDistance, formatMinutes, localized, placeName, plural } from "@/lib/i18n/format";
import { categoryDef, subcategoryLabel } from "@/lib/taxonomy";
import { CoverArt } from "@/components/place/cover-art";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import { Rail } from "@/components/home/rail";
import { MiniMap } from "@/components/map/mini-map";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/[lang]/neighbourhoods/[slug]">): Promise<Metadata> {
  const { t, locale } = await getDictionary();
  const { slug } = await params;
  const h = (await getCatalog()).hoodBySlug.get(slug);
  if (!h) return {};
  const row = await getNeighbourhood(slug);
  const name = locale === "ar" ? h.nameAr || h.nameEn : h.nameEn;
  return {
    title: name,
    description: (localized(locale, row?.introEn, row?.introAr) ?? fmt(t.hoods.explore, { name })).slice(0, 160),
  };
}

export default async function NeighbourhoodPage({ params }: PageProps<"/[lang]/neighbourhoods/[slug]">) {
  const { t, locale } = await getDictionary();
  const { slug } = await params;
  const catalog = await getCatalog();
  const lite = catalog.hoodBySlug.get(slug);
  const row = lite ? await getNeighbourhood(slug) : null;
  if (!lite || !row) notFound();

  const name = locale === "ar" ? lite.nameAr || lite.nameEn : lite.nameEn;
  const otherName = locale === "ar" ? lite.nameEn : lite.nameAr;
  const intro = localized(locale, row.introEn, row.introAr);
  const practical = (localized(locale, row.practicalEn, row.practicalAr) ?? "").split("\n").filter(Boolean);
  const list = placesIn(catalog, slug);
  const sections = hoodSections(list);
  const route = walkingRoute(list);
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const mapPlaces = mapHighlights(list);

  const rails: { key: keyof typeof sections; title: string; href: string }[] = [
    { key: "popular", title: t.hoods.popular, href: `/${locale}/explore?area=${slug}` },
    { key: "culture", title: t.hoods.culture, href: `/${locale}/explore?area=${slug}&cat=culture` },
    { key: "food", title: t.hoods.food, href: `/${locale}/explore?area=${slug}&cat=restaurants` },
    { key: "entertainment", title: t.hoods.entertainment, href: `/${locale}/explore?area=${slug}&cat=entertainment` },
    { key: "outdoors", title: t.hoods.outdoors, href: `/${locale}/explore?area=${slug}&cat=outdoors` },
    { key: "shopping", title: t.hoods.shopping, href: `/${locale}/explore?area=${slug}&cat=shopping` },
  ];
  // Don't repeat a section that would just echo "Popular" for small areas.
  const shown = new Set<string>();
  const visibleRails = rails.filter((r) => {
    const items = sections[r.key];
    if (items.length === 0) return false;
    if (r.key !== "popular" && items.every((p) => shown.has(p.id)) && items.length < 3) return false;
    items.forEach((p) => shown.add(p.id));
    return true;
  });

  return (
    <article>
      <div className="relative h-72 bg-ink-900 md:h-[420px]">
        {row.hero ? (
          <Image src={row.hero.url} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <CoverArt seed={slug} category="hoods" initial={name} className="absolute inset-0 size-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-7xl px-4 pb-7 text-white md:px-6 md:pb-10">
            <Link href={`/${locale}/neighbourhoods`} className="text-sm text-white/75 hover:text-white">
              {t.hoods.title}
            </Link>
            <h1 className="mt-1 font-display text-[40px] font-semibold leading-tight md:text-[56px]">{name}</h1>
            {otherName && otherName !== name && (
              <p className="text-lg text-white/75" lang={locale === "ar" ? "en" : "ar"} dir="auto">
                {otherName}
              </p>
            )}
          </div>
        </div>
        {row.hero?.author && (
          <a href={row.hero.sourceUrl ?? undefined} target="_blank" rel="noreferrer noopener" className="absolute end-3 top-3 rounded bg-black/30 px-1.5 text-[10px] text-white/80 hover:text-white">
            {t.home.photoBy.replace("{author}", row.hero.author)}
            {row.hero.license ? ` · ${row.hero.license}` : ""}
          </a>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_440px]">
          <div className="min-w-0 space-y-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-coral-500">{plural(locale, list.length, t.hoods.placesHere)}</p>
            <p className="max-w-prose text-[18px] leading-relaxed text-ink-800">{intro ?? t.hoods.noGuide}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/${locale}/plan?area=${slug}`} className={buttonClass("primary")}>
                <Route className="size-[18px]" /> {fmt(t.hoods.itineraryCta, { name })}
              </Link>
              <Link href={`/${locale}/map?area=${slug}`} className={buttonClass("secondary")}>
                <MapIcon className="size-[18px]" /> {t.nav.map}
              </Link>
              <Link href={`/${locale}/explore?area=${slug}`} className={buttonClass("secondary")}>
                <Compass className="size-[18px]" /> {fmt(t.hoods.explore, { name })}
              </Link>
            </div>
            {practical.length > 0 && (
              <section className="rounded-3xl bg-sand-200/60 p-5 md:p-6" aria-labelledby="practical-title">
                <h2 id="practical-title" className="flex items-center gap-2 font-display text-xl font-semibold">
                  <Info className="size-5 text-sea-600" /> {t.hoods.practical}
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[15px] text-ink-700 marker:text-sea-500">
                  {practical.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <div>
            <MiniMap
              className="h-72 md:h-80"
              ariaLabel={fmt(t.hoods.mapLabel, { name })}
              polygon={row.polygon}
              markers={mapPlaces.map((p) => ({
                id: p.id,
                lat: p.lat,
                lng: p.lng,
                color: categoryDef(p.category).color,
                label: placeName(locale, p),
                href: `/${locale}/place/${p.slug}`,
              }))}
            />
            <p className="mt-2 text-xs text-ink-500">{t.hoods.boundarySource}</p>
          </div>
        </div>
      </div>

      <div className="space-y-12 pb-14">
        {visibleRails.map((r) => (
          <Rail key={r.key} title={r.title} href={r.href}>
            {sections[r.key].map((p) => (
              <PlaceCard key={`${r.key}-${p.id}`} p={p} locale={locale} t={t} hoods={hoods} />
            ))}
          </Rail>
        ))}

        <section className="mx-auto max-w-7xl px-4 md:px-6" aria-labelledby="walk-title">
          <h2 id="walk-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Footprints className="size-6 text-sea-600" /> {t.hoods.walkingRoute}
          </h2>
          {route ? (
            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_440px]">
              <div className="min-w-0">
                <p className="text-ink-600">
                  {fmt(t.hoods.walkingRouteNote, { distance: formatDistance(locale, route.km), time: formatMinutes(locale, route.walkMinutes) })}
                </p>
                <ol className="mt-4 space-y-2">
                  {route.stops.map((p, i) => (
                    <li key={p.id}>
                      <Link href={`/${locale}/place/${p.slug}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-sand-200 transition hover:ring-ink-300">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-semibold text-white tabular-nums">
                          {new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en").format(i + 1)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{placeName(locale, p)}</span>
                          <span className="block truncate text-sm text-ink-500">
                            {subcategoryLabel(p.sub, locale) ?? categoryDef(p.category).name[locale]}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-ink-500">{t.hoods.walkingEstimateNote}</p>
              </div>
              <MiniMap
                className="h-72"
                connect
                ariaLabel={t.hoods.walkingRoute}
                markers={route.stops.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, n: i + 1, label: placeName(locale, p), href: `/${locale}/place/${p.slug}` }))}
              />
            </div>
          ) : (
            <p className="mt-3 max-w-prose text-ink-600">{t.hoods.notWalkable}</p>
          )}
        </section>
      </div>
    </article>
  );
}
