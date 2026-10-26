import Link from "next/link";
import { after } from "next/server";
import { Info } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/places/catalog";
import { searchPlaces } from "@/lib/search/engine";
import { understoodChips } from "@/lib/search/understood";
import type { ExploreState } from "@/lib/search/params";
import { toSearchParams } from "@/lib/search/params";
import { normalizeText } from "@/lib/search/normalize";
import { db } from "@/lib/db";
import { searchLog } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { recordInteraction } from "@/lib/stats";
import { plural } from "@/lib/i18n/format";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import { ExploreControls } from "./explore-controls";
import { interpretQuery } from "@/lib/search/interpret";

const PAGE_SIZE = 24;

export async function ExploreView({ state, fixedCategory, basePath }: { state: ExploreState; fixedCategory?: string; basePath: string }) {
  const { t, locale } = await getDictionary();
  const catalog = await getCatalog();
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const hoodName = (slug: string) => {
    const h = catalog.hoodBySlug.get(slug);
    return h ? (locale === "ar" ? h.nameAr || h.nameEn : h.nameEn) : slug;
  };

  const interpreted = state.q ? await interpretQuery(state.q, catalog.hoodVocab) : null;
  const result = await searchPlaces(catalog, {
    q: state.q,
    parsed: interpreted?.parsed,
    ignore: state.ignore,
    category: fixedCategory ?? state.cat,
    hood: state.area,
    maxPrice: state.max,
    free: state.free,
    openNow: state.open,
    minRating: state.rating,
    attrs: state.attrs,
    hideChains: state.hideChains,
    verifiedOnly: state.verified,
    origin: state.near,
    radiusKm: state.dist,
    sort: state.sort,
    limit: PAGE_SIZE * state.page,
    offset: 0,
  });

  const chips = understoodChips(result.parsed.understood.filter((u) => !state.ignore.includes(keyOf(u))), t, locale, hoodName);

  if (state.q && state.page === 1) {
    const user = await getCurrentUser();
    after(async () => {
      await db
        .insert(searchLog)
        .values({ query: state.q.slice(0, 120), normalized: normalizeText(state.q).slice(0, 120), locale, results: result.total })
        .catch(() => {});
      await recordInteraction(user, "search", { query: state.q });
    });
  }

  const hasMore = result.total > result.hits.length;
  const nextHref = `${basePath}?${toSearchParams({ ...state, page: state.page + 1 }).toString()}`;
  const timeFilter = !!result.parsed.when && !state.ignore.includes("when");

  return (
    <div className="space-y-5">
      <ExploreControls state={state} chips={chips} fixedCategory={fixedCategory} basePath={basePath} />

      {state.q && (
        <p className="flex items-start gap-2 text-xs text-ink-500">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold text-ink-700">{t.explore.smartSearch}:</strong>{" "}
            {interpreted?.mode === "ai" ? t.explore.aiAssisted : t.explore.ruleBased}
          </span>
        </p>
      )}

      <div className="space-y-1 text-sm">
        <p className="font-medium text-ink-700" aria-live="polite">
          {plural(locale, result.total, t.explore.results)}
        </p>
        {result.relaxed && <p className="text-ink-500">{t.explore.relaxedNote}</p>}
        {timeFilter && <p className="text-ink-500">{t.explore.timeNote}</p>}
        {timeFilter && result.noHoursCount > 0 && <p className="text-ink-500">{plural(locale, result.noHoursCount, t.explore.noHoursNote)}</p>}
        {result.parsed.waterfront && !state.ignore.includes("waterfront") && <p className="text-ink-500">{t.explore.waterfrontNote}</p>}
        {(state.max || state.free || result.parsed.maxPrice || result.parsed.free) && <p className="text-ink-500">{t.explore.priceFilterNote}</p>}
        {state.open && <p className="text-ink-500">{t.explore.openNowNote}</p>}
        {result.sortFallback && <p className="text-coral-500">{t.explore.sortNeedsLocation}</p>}
        {state.sort === "rating" && <p className="text-ink-500">{t.explore.sortRatingNote}</p>}
      </div>

      {result.hits.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-card">
          <p className="font-display text-xl">{t.explore.noResults}</p>
          <p className="mt-2 text-sm text-ink-500">{t.explore.noResultsHint}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {result.hits.map((p, i) => (
            <li key={p.id}>
              <PlaceCard p={p} locale={locale} t={t} hoods={hoods} distanceKm={p.distanceKm} priority={i < 2} size="grid" />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Link href={nextHref} scroll={false} className="rounded-full bg-white px-6 py-3 text-sm font-semibold shadow-card ring-1 ring-sand-200 hover:ring-ink-300">
            {t.explore.loadMore}
          </Link>
        </div>
      )}
    </div>
  );
}

function keyOf(u: { kind: string; value?: unknown }): string {
  switch (u.kind) {
    case "category":
    case "sub":
    case "attr":
    case "occasion":
    case "hood":
      return `${u.kind}:${u.value}`;
    default:
      return u.kind;
  }
}
