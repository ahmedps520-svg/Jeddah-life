import type { Understood } from "./parse";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/config";
import { OCCASIONS, categoryDef } from "@/lib/taxonomy";
import { formatNumber } from "@/lib/i18n/format";

export type Chip = { key: string; label: string };

/** Human-readable chips for what the rule-based parser understood. */
export function understoodChips(
  list: Understood[],
  t: Dictionary,
  locale: Locale,
  hoodName: (slug: string) => string,
): Chip[] {
  const c = t.explore.chips as Record<string, string>;
  const attrLabel: Record<string, string> = {
    family: t.attrs.familyFriendly,
    indoor: t.attrs.indoor,
    outdoor: t.attrs.outdoor,
    groups: t.attrs.groups,
    photo: t.attrs.photoSpot,
    romantic: t.attrs.romantic,
    quiet: t.attrs.quiet,
    wheelchair: t.attrs.wheelchair,
    late: t.attrs.lateNight,
  };
  const seen = new Set<string>();
  const out: Chip[] = [];
  for (const u of list) {
    let chip: Chip | null = null;
    switch (u.kind) {
      case "category":
        chip = { key: `category:${u.value}`, label: categoryDef(u.value).name[locale] };
        break;
      case "sub":
        chip = { key: `sub:${u.value}`, label: c[u.value] ?? u.value };
        break;
      case "maxPrice":
        chip = { key: "maxPrice", label: t.explore.priceUnder.replace("{n}", formatNumber(locale, u.value)) };
        break;
      case "free":
        chip = { key: "free", label: t.common.free };
        break;
      case "upscale":
        chip = { key: "upscale", label: c.upscale };
        break;
      case "openNow":
        chip = { key: "openNow", label: t.explore.openNow };
        break;
      case "when": {
        const w = u.value;
        const label =
          w.kind === "day" ? (w.weekday === 4 ? c.thursday : w.weekday === 6 ? c.saturday : c.friday) : c[w.kind] ?? w.kind;
        chip = { key: "when", label };
        break;
      }
      case "attr":
        chip = { key: `attr:${u.value}`, label: attrLabel[u.value] ?? u.value };
        break;
      case "occasion":
        chip = { key: `occasion:${u.value}`, label: OCCASIONS.find((o) => o.slug === u.value)?.name[locale] ?? u.value };
        break;
      case "hood":
        chip = { key: `hood:${u.value}`, label: hoodName(u.value) };
        break;
      case "waterfront":
        chip = { key: "waterfront", label: c.waterfront };
        break;
      case "nearMe":
        chip = { key: "nearMe", label: c.nearMe };
        break;
      case "activities":
        chip = { key: "activities", label: c.activities };
        break;
    }
    if (chip && !seen.has(chip.key)) {
      seen.add(chip.key);
      out.push(chip);
    }
  }
  return out;
}
