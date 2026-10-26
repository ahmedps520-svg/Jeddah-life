import { getCatalog } from "@/lib/places/catalog";
import { handler, json } from "@/lib/api";
import { tokenize } from "@/lib/search/normalize";
import { PLACE_CATEGORIES, subcategoryLabel } from "@/lib/taxonomy";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";
  const tokens = tokenize(q);
  if (!tokens.length) return json({ suggestions: [] });
  const c = await getCatalog();
  const starts = (s: string | null | undefined) => {
    if (!s) return false;
    const st = tokenize(s);
    return tokens.every((t) => st.some((x) => x.startsWith(t)));
  };
  const out: Array<{ kind: string; label: string; sub?: string; href: string }> = [];
  for (const cat of PLACE_CATEGORIES) {
    if (starts(cat.name.en) || starts(cat.name.ar)) out.push({ kind: "category", label: cat.name[locale], href: `/category/${cat.slug}` });
  }
  for (const h of c.hoods) {
    if (starts(h.nameEn) || starts(h.nameAr)) out.push({ kind: "hood", label: locale === "ar" ? h.nameAr || h.nameEn : h.nameEn, href: `/neighbourhoods/${h.slug}` });
    if (out.length > 4) break;
  }
  const seenBrand = new Set<string>();
  const places = c.places
    .filter((p) => starts(p.nameEn) || starts(p.nameAr))
    .sort((a, b) => Number(b.ver === "verified") - Number(a.ver === "verified") || Number(!!b.img) - Number(!!a.img));
  for (const p of places) {
    if (p.brand) {
      if (seenBrand.has(p.brand)) continue;
      seenBrand.add(p.brand);
    }
    const name = locale === "ar" ? p.nameAr || p.nameEn : p.nameEn || p.nameAr;
    out.push({ kind: "place", label: name ?? "", sub: subcategoryLabel(p.sub, locale) ?? undefined, href: p.brand ? `/explore?q=${encodeURIComponent(name ?? "")}` : `/place/${p.slug}` });
    if (out.length >= 8) break;
  }
  return json({ suggestions: out.slice(0, 8) });
});
