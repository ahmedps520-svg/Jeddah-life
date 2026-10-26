import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { parseExploreParams } from "@/lib/search/params";
import { ExploreView } from "@/components/explore/explore-view";
import { PLACE_CATEGORIES } from "@/lib/taxonomy";
import { getCatalog } from "@/lib/places/catalog";
import { categoryCount, categoryCover } from "@/lib/home";
import { CoverArt } from "@/components/place/cover-art";
import { plural } from "@/lib/i18n/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/category/[slug]">): Promise<Metadata> {
  const { locale } = await getDictionary();
  const { slug } = await params;
  const def = PLACE_CATEGORIES.find((c) => c.slug === slug);
  return def ? { title: def.name[locale], description: def.tagline[locale] } : {};
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[lang]/category/[slug]">) {
  const { t, locale } = await getDictionary();
  const { slug } = await params;
  const def = PLACE_CATEGORIES.find((c) => c.slug === slug);
  if (!def) notFound();
  const catalog = await getCatalog();
  const cover = categoryCover(catalog, slug);
  const count = categoryCount(catalog, slug);
  const state = parseExploreParams(await searchParams);
  const note = slug === "nightlife" ? t.categories.nightlifeNote : slug === "family" ? t.categories.familyNote : null;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink-900 text-sand-50">
        <div className="absolute inset-0 -z-10">
          {cover?.img ? (
            <Image src={cover.img.url} alt="" fill priority sizes="100vw" className="object-cover opacity-60" />
          ) : (
            <CoverArt seed={slug} category={slug} className="size-full opacity-80" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-ink-950/10" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-20 pb-8 md:px-6 md:pt-28">
          <h1 className="font-display text-[40px] font-semibold leading-none md:text-[56px]">{def.name[locale]}</h1>
          <p className="mt-3 max-w-xl text-sand-200">{def.tagline[locale]}</p>
          <p className="mt-2 text-sm text-sand-300">{plural(locale, count, t.categories.placesCount)}</p>
          {note && <p className="mt-3 max-w-2xl text-xs text-sand-300">{note}</p>}
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <ExploreView state={state} fixedCategory={slug} basePath={`/${locale}/category/${slug}`} />
      </div>
    </>
  );
}
