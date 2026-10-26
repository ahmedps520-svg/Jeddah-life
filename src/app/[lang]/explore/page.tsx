import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { parseExploreParams } from "@/lib/search/params";
import { ExploreView } from "@/components/explore/explore-view";
import { SearchBar } from "@/components/layout/search-bar";

export async function generateMetadata({ searchParams }: PageProps<"/[lang]/explore">): Promise<Metadata> {
  const { t } = await getDictionary();
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `“${q}”` : t.explore.title };
}

export default async function ExplorePage({ searchParams }: PageProps<"/[lang]/explore">) {
  const { t, locale } = await getDictionary();
  const state = parseExploreParams(await searchParams);
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6 max-w-3xl">
        <h1 className="font-display text-[34px] font-semibold leading-tight md:text-[44px]">{t.explore.title}</h1>
        <p className="mt-2 text-ink-500">{t.explore.lede}</p>
        <div className="mt-5">
          <SearchBar key={state.q} initial={state.q} />
        </div>
      </header>
      <ExploreView state={state} basePath={`/${locale}/explore`} />
    </div>
  );
}
