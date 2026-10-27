import type { Metadata } from "next";
import Link from "next/link";
import { Gem, Plus, Sparkles } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/places/catalog";
import { communityGemPlaceIds, communityGems, editorialGems, gemNotes } from "@/lib/gems";
import { GEM_TYPES } from "@/lib/taxonomy";
import { localized } from "@/lib/i18n/format";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import { GemCard } from "@/components/gems/gem-card";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.gems.title, description: t.gems.lede };
}

export default async function HiddenGemsPage({ searchParams }: PageProps<"/[lang]/hidden-gems">) {
  const { t, locale } = await getDictionary();
  const sp = await searchParams;
  const type = typeof sp.type === "string" && GEM_TYPES.some((g) => g.slug === sp.type) ? sp.type : null;
  const catalog = await getCatalog();
  const editorial = editorialGems(catalog, type, await communityGemPlaceIds());
  const [notes, community] = await Promise.all([gemNotes(editorial.map((p) => p.id)), communityGems(type)]);
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const hoodName = (slug: string | null) => {
    const h = slug ? catalog.hoodBySlug.get(slug) : null;
    return h ? (locale === "ar" ? h.nameAr || h.nameEn : h.nameEn) : null;
  };
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${active ? "bg-ink-900 text-white" : "bg-white ring-1 ring-sand-200 hover:ring-ink-300"}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <h1 className="flex items-center gap-3 font-display text-[38px] font-semibold leading-tight md:text-[48px]">
            <Gem className="size-9 text-sea-500" /> {t.gems.title}
          </h1>
          <p className="mt-3 text-lg text-ink-600">{t.gems.lede}</p>
          <p className="mt-2 text-sm text-ink-500">{t.gems.notHiddenGemRule}</p>
        </div>
        <Link href={`/${locale}/hidden-gems/submit`} className={buttonClass("primary")}>
          <Plus className="size-[18px]" /> {t.gems.submit}
        </Link>
      </header>

      <div className="rail -mx-4 mt-8 gap-2 px-4 md:mx-0 md:flex md:flex-wrap md:px-0" role="group" aria-label={t.gems.type}>
        <Link href={`/${locale}/hidden-gems`} className={chip(!type)} aria-current={!type ? "true" : undefined}>
          {t.gems.all}
        </Link>
        {GEM_TYPES.map((g) => (
          <Link key={g.slug} href={`/${locale}/hidden-gems?type=${g.slug}`} className={chip(type === g.slug)} aria-current={type === g.slug ? "true" : undefined}>
            {g.name[locale]}
          </Link>
        ))}
      </div>

      {editorial.length > 0 && (
        <section className="mt-10" aria-labelledby="ed-title">
          <h2 id="ed-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Sparkles className="size-5 text-gold-500" /> {t.gems.editorialTitle}
          </h2>
          <ul className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {editorial.map((p) => {
              const note = notes.get(p.id);
              const text = note ? localized(locale, note.en, note.ar) : null;
              return (
                <li key={p.id} className="min-w-0">
                  <PlaceCard p={p} locale={locale} t={t} hoods={hoods} size="grid" />
                  {text && <p className="mt-2 text-sm text-ink-600">{text}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-14" aria-labelledby="com-title">
        <h2 id="com-title" className="font-display text-2xl font-semibold">
          {t.gems.communityTitle}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">{t.gems.communityNote}</p>
        {community.length > 0 ? (
          <ul className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {community.map((g) => (
              <li key={g.id} className="min-w-0">
                <GemCard g={g} locale={locale} t={t} hoodName={hoodName(g.neighbourhood)} size="grid" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-3xl bg-white p-8 text-center shadow-card">
            <Gem className="mx-auto size-9 text-ink-300" />
            <p className="mt-3 font-display text-xl">{t.gems.emptyCommunity}</p>
            <Link href={`/${locale}/hidden-gems/submit`} className={`${buttonClass("secondary")} mt-5`}>
              {t.gems.submit}
            </Link>
          </div>
        )}
      </section>

      {editorial.length === 0 && community.length === 0 && type && (
        <p className="mt-8 text-center text-ink-500">
          <Link href={`/${locale}/hidden-gems`} className="text-sea-600 hover:underline">
            {t.gems.all}
          </Link>
        </p>
      )}
    </div>
  );
}
