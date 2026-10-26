import { getCatalog } from "@/lib/places/catalog";
import { searchPlaces } from "@/lib/search/engine";
import { interpretQuery } from "@/lib/search/interpret";
import { understoodChips } from "@/lib/search/understood";
import { dictionaryFor } from "@/lib/i18n/server";
import { handler, json } from "@/lib/api";

/** Natural-language search for the map: returns matching place ids in relevance order. */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 160);
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";
  const c = await getCatalog();
  const it = await interpretQuery(q, c.hoodVocab);
  const r = await searchPlaces(c, { q, parsed: it.parsed, limit: 5000 });
  const t = dictionaryFor(locale);
  const chips = understoodChips(r.parsed.understood, t, locale, (slug) => {
    const h = c.hoodBySlug.get(slug);
    return h ? (locale === "ar" ? h.nameAr || h.nameEn : h.nameEn) : slug;
  });
  return json({ ids: r.hits.map((h) => h.id), total: r.total, chips, mode: it.mode });
});
