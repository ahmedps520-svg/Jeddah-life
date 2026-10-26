import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Wallet, Route } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/places/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import {
  approvedGemSubmissions,
  categoryCount,
  categoryCover,
  editorsPicks,
  familyFriendly,
  getHeroSlides,
  hiddenGemPlaces,
  newPlaces,
  trending,
  under50,
  upcomingEvents,
  weekend,
  worthVisiting,
} from "@/lib/home";
import { explain, popularWithPlanningFriends, recommendFor } from "@/lib/recommend";
import { CATEGORIES } from "@/lib/taxonomy";
import { Hero, type HeroSlide } from "@/components/home/hero";
import { Rail } from "@/components/home/rail";
import { NearYou } from "@/components/home/near-you";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import { CoverArt } from "@/components/place/cover-art";
import { EventCard } from "@/components/events/event-card";
import { buttonClass } from "@/components/ui/button";
import { plural } from "@/lib/i18n/format";
import { RecommendationCard } from "@/components/home/recommendation-card";

export default async function HomePage() {
  const { t, locale } = await getDictionary();
  const [catalog, user, slidesRaw, events] = await Promise.all([getCatalog(), getCurrentUser(), getHeroSlides(), upcomingEvents(10)]);

  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const hoodName = (slug: string) => {
    const h = catalog.hoodBySlug.get(slug);
    return h ? (locale === "ar" ? h.nameAr || h.nameEn : h.nameEn) : slug;
  };

  const slides: HeroSlide[] = slidesRaw.map((s) => ({
    id: s.id,
    theme: (t.home.themes as Record<string, string>)[s.theme] ?? s.theme,
    title: locale === "ar" ? s.titleAr : s.titleEn,
    subtitle: locale === "ar" ? s.subtitleAr : s.subtitleEn,
    href: s.href,
    image: s.image,
  }));

  const recs = user ? await recommendFor(user, catalog, { limit: 12 }) : null;
  const friends = user ? await popularWithPlanningFriends(user.id, catalog) : [];
  const trend = trending(catalog);
  const picks = editorsPicks(catalog);
  const gems = hiddenGemPlaces(catalog);
  const gemSubs = gems.length ? [] : await approvedGemSubmissions(8);
  const featuredHoods = catalog.hoods.filter((h) => h.featured).slice(0, 8);
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  const cards = (list: typeof picks, prefix: string, size: "md" | "lg" = "md") =>
    list.map((p, i) => <PlaceCard key={`${prefix}-${p.id}`} p={p} locale={locale} t={t} hoods={hoods} size={size} priority={i < 2 && prefix === "first"} />);

  return (
    <>
      <Hero slides={slides} />

      {/* Categories */}
      <section aria-labelledby="cats" className="mx-auto max-w-7xl px-4 pt-10 pb-4 md:px-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 id="cats" className="font-display text-[28px] font-semibold md:text-[34px]">
              {t.home.categoriesTitle}
            </h2>
            <p className="mt-1 text-sm text-ink-500">{t.home.categoriesLede}</p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => {
            const cover = c.slug === "events" || c.slug === "hidden-gems" ? null : categoryCover(catalog, c.slug);
            const count =
              c.slug === "events" ? events.length : c.slug === "hidden-gems" ? gems.length : categoryCount(catalog, c.slug);
            const href = c.href ?? `/category/${c.slug}`;
            return (
              <li key={c.slug} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <Link
                  href={`/${locale}${href}`}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] shadow-card sm:aspect-[5/4]"
                >
                  {cover?.img ? (
                    <Image src={cover.img.url} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover transition duration-700 group-hover:scale-105" />
                  ) : (
                    <CoverArt seed={c.slug} category={c.slug === "hidden-gems" ? "outdoors" : c.slug} className="absolute inset-0 size-full transition duration-700 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5 text-sand-50">
                    <h3 className="font-display text-[19px] font-semibold leading-tight md:text-[22px]">{c.name[locale]}</h3>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-sand-200/90">{c.tagline[locale]}</p>
                    {c.slug !== "events" && c.slug !== "hidden-gems" && (
                      <p className="mt-1 text-[11px] text-sand-300">{plural(locale, count, t.categories.placesCount)}</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Personalised, or editorial when we know nothing about the user */}
      {recs && recs.length > 0 ? (
        <Rail id="for-you" title={t.home.forYou} note={t.home.forYouNote}>
          {recs.map((r) => (
            <RecommendationCard
              key={r.place.id}
              p={r.place}
              hoods={hoods}
              why={explain(r.reasons, locale, t.recs, hoodName)}
            />
          ))}
        </Rail>
      ) : null}

      {trend.length > 0 ? (
        <Rail id="trending" title={t.home.trending} note={t.home.trendingNote}>
          {cards(trend, "first", "lg")}
        </Rail>
      ) : picks.length > 0 ? (
        <Rail id="picks" title={t.home.editorsPicks} note={t.home.editorsPicksNote}>
          {cards(picks, "first", "lg")}
        </Rail>
      ) : null}

      {!user && (
        <p className="mx-auto max-w-7xl px-4 text-sm text-ink-500 md:px-6">
          <Link href={`/${locale}/auth/sign-up`} className="font-medium text-sea-600 hover:underline">
            {t.home.signInForYou}
          </Link>
        </p>
      )}

      <NearYou hoods={hoods} />

      {/* Planner promo */}
      <section className="mx-auto my-8 max-w-7xl px-4 md:px-6">
        <div className="grid overflow-hidden rounded-3xl bg-ink-900 text-sand-50 shadow-lift md:grid-cols-2">
          <div className="relative p-7 md:p-10">
            <Wallet className="size-7 text-coral-400" />
            <h2 className="mt-4 font-display text-[30px] font-semibold leading-tight md:text-[38px]">{t.home.mihTitle}</h2>
            <p className="mt-3 max-w-md text-sand-200">{t.home.mihLede}</p>
            <Link href={`/${locale}/make-it-happen`} className={buttonClass("primary", "lg", "mt-6")}>
              {t.home.mihCta}
              <Arrow className="size-5" />
            </Link>
          </div>
          <div className="relative border-t border-white/10 p-7 md:border-s md:border-t-0 md:p-10">
            <Route className="size-7 text-sea-300" />
            <h2 className="mt-4 font-display text-[26px] font-semibold leading-tight md:text-[30px]">{t.home.planTitle}</h2>
            <p className="mt-3 max-w-md text-sand-200">{t.home.planLede}</p>
            <Link href={`/${locale}/plan`} className={buttonClass("outline-light", "lg", "mt-6")}>
              {t.home.planCta}
            </Link>
          </div>
        </div>
      </section>

      {under50(catalog).length > 0 && (
        <Rail id="under-50" title={t.home.under50} note={t.home.under50Note} href="/explore?max=50">
          {cards(under50(catalog), "u50")}
        </Rail>
      )}

      {weekend(catalog).length > 0 && (
        <Rail id="weekend" title={t.home.weekend} note={t.home.weekendNote}>
          {cards(weekend(catalog), "wk")}
        </Rail>
      )}

      {events.length > 0 && (
        <Rail id="events" title={t.home.eventsSoon} href="/events">
          {events.map((e) => (
            <EventCard
              key={e.id}
              e={e}
              locale={locale}
              labels={{ free: t.events.free, from: t.events.from, notListed: t.events.priceNotListed, adminManaged: t.events.adminManaged, fromFeed: t.events.fromFeed }}
            />
          ))}
        </Rail>
      )}

      {worthVisiting(catalog).length > 0 && (
        <Rail id="worth" title={t.home.worthVisiting} note={t.home.worthVisitingNote}>
          {cards(worthVisiting(catalog), "wv", "lg")}
        </Rail>
      )}

      {featuredHoods.length > 0 && (
        <section aria-labelledby="hoods" className="mx-auto max-w-7xl px-4 py-6 md:px-6">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="hoods" className="font-display text-[24px] font-semibold md:text-[28px]">
              {t.home.neighbourhoodsTitle}
            </h2>
            <Link href={`/${locale}/neighbourhoods`} className="text-sm font-medium text-sea-600 hover:underline">
              {t.home.neighbourhoodsCta}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {featuredHoods.map((h) => (
              <li key={h.slug}>
                <Link
                  href={`/${locale}/neighbourhoods/${h.slug}`}
                  className="block rounded-full bg-white px-4 py-2 text-[15px] shadow-card ring-1 ring-sand-200 transition hover:ring-sea-300"
                >
                  {locale === "ar" ? h.nameAr || h.nameEn : h.nameEn}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {familyFriendly(catalog).length > 0 && (
        <Rail id="family" title={t.home.family} note={t.home.familyNote} href="/category/family">
          {cards(familyFriendly(catalog), "fam")}
        </Rail>
      )}

      {friends.length > 0 && (
        <Rail id="friends" title={t.home.friends} note={t.home.friendsNote}>
          {cards(friends, "fr")}
        </Rail>
      )}

      {(gems.length > 0 || gemSubs.length > 0) && (
        <Rail id="gems" title={t.home.gems} note={t.home.gemsNote} href="/hidden-gems">
          {cards(gems, "gem")}
        </Rail>
      )}

      {newPlaces(catalog).length > 0 && (
        <Rail id="new" title={t.home.newPlaces} note={t.home.newPlacesNote}>
          {cards(newPlaces(catalog), "new")}
        </Rail>
      )}
    </>
  );
}
