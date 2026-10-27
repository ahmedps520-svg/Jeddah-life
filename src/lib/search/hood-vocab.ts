import { HOOD_ALIASES } from "@/lib/places/hood-aliases";
import { skeletons, tokenize } from "./normalize";
import type { HoodVocab } from "./parse";

/** Names, aliases and spelling skeletons the query parser uses to recognise areas. */
export function buildHoodVocab(hoods: { slug: string; nameEn: string; nameAr: string | null }[]): HoodVocab[] {
  const vocab = hoods.map((h) => {
    const names = [h.nameEn, h.nameAr ?? "", ...(HOOD_ALIASES[h.slug] ?? [])].filter(Boolean);
    const tokens = names.map((n) => tokenize(n)).filter((t) => t.length);
    const sk = new Set<string>();
    for (const t of tokens) if (t.length === 1) skeletons(t[0]).forEach((s) => sk.add(s));
    return { slug: h.slug, tokens, skeletons: [...sk] };
  });
  // Longer names first so "south obhur" wins over "obhur".
  return vocab.sort((a, b) => Math.max(...b.tokens.map((t) => t.length), 0) - Math.max(...a.tokens.map((t) => t.length), 0));
}
