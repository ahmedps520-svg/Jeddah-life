import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { parseQuery, type Attr, type HoodVocab, type ParsedQuery, type Understood } from "./parse";
import { tokenize } from "./normalize";

/**
 * Turns a free-text request into structured filters.
 *
 * The rule-based parser always runs. When an Anthropic API key is
 * configured and the request reads like a sentence (four or more words),
 * we ask Claude to interpret it into the same structure instead. The UI
 * labels which of the two produced the result; any failure, timeout or
 * refusal falls back to the rule-based interpretation silently.
 */

export type Interpretation = { parsed: ParsedQuery; mode: "rules" | "ai" };

const MODEL = process.env.SEARCH_AI_MODEL || "claude-opus-5-5";
const TIMEOUT_MS = Number(process.env.SEARCH_AI_TIMEOUT_MS || 6000);

const CATEGORIES = ["restaurants", "cafes", "entertainment", "beaches", "shopping", "adventure", "family", "nightlife", "sports", "culture", "outdoors"] as const;
const SUBS = ["ice_cream", "dessert", "breakfast", "seafood", "burger", "pizza", "japanese", "italian", "indian", "arab", "grill", "fast_food", "cinema", "games"] as const;
const ATTRS = ["family", "indoor", "outdoor", "groups", "photo", "romantic", "quiet", "wheelchair", "late"] as const;
const OCCASIONS = ["birthday", "date", "friends", "family", "visitors", "work", "photos"] as const;

const Schema = z.object({
  categories: z.array(z.enum(CATEGORIES)).describe("Place categories the user wants. Empty if not specified."),
  cuisineOrVenueTypes: z.array(z.enum(SUBS)).describe("Narrower food or venue types, if any."),
  maxPricePerPersonSar: z.number().nullable().describe("Maximum spend per person in Saudi riyals, or null. 'cheap' means about 40."),
  freeOnly: z.boolean(),
  upscale: z.boolean(),
  openNow: z.boolean(),
  when: z.enum(["none", "tonight", "today", "weekend", "thursday", "friday", "saturday"]),
  attributes: z.array(z.enum(ATTRS)),
  occasions: z.array(z.enum(OCCASIONS)),
  neighbourhoodSlugs: z.array(z.string()).describe("Slugs from the provided neighbourhood list only."),
  nearWaterfront: z.boolean(),
  nearUser: z.boolean(),
  thingsToDo: z.boolean().describe("True when the user wants activities rather than food."),
  nameKeywords: z.array(z.string()).describe("Words that look like a specific place or brand name to match literally. Usually empty."),
});

const cache = new Map<string, ParsedQuery>();

export function aiEnabled() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && process.env.SEARCH_AI !== "off";
}

export async function interpretQuery(q: string, hoodVocab: HoodVocab[]): Promise<Interpretation> {
  const rules = parseQuery(q, hoodVocab);
  const words = q.trim().split(/\s+/).length;
  if (!aiEnabled() || words < 4) return { parsed: rules, mode: "rules" };

  const key = q.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return { parsed: cached, mode: "ai" };

  try {
    const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
    const hoodList = hoodVocab.map((h) => `${h.slug}: ${h.tokens.map((t) => t.join(" ")).join(" / ")}`).join("\n");
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: "low", format: zodOutputFormat(Schema) },
      system:
        "You convert search requests for a Jeddah, Saudi Arabia city guide into filters. Requests may be in English or Arabic (including Saudi dialect). " +
        "Only set a filter when the request clearly asks for it. Saudi weekends are Friday and Saturday. Prices are in Saudi riyals per person. " +
        "Neighbourhood slugs must come from this list (slug: names):\n" +
        hoodList,
      messages: [{ role: "user", content: q.slice(0, 300) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return { parsed: rules, mode: "rules" };
    const parsed = fromAi(q, response.parsed_output, new Set(hoodVocab.map((h) => h.slug)));
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, parsed);
    return { parsed, mode: "ai" };
  } catch {
    return { parsed: rules, mode: "rules" };
  }
}

function fromAi(raw: string, out: z.infer<typeof Schema>, hoods: Set<string>): ParsedQuery {
  const understood: Understood[] = [];
  const categories = [...new Set(out.categories)];
  categories.forEach((c) => understood.push({ kind: "category", value: c }));
  const subs = [...new Set(out.cuisineOrVenueTypes)];
  subs.forEach((s) => understood.push({ kind: "sub", value: s }));
  const maxPrice = out.maxPricePerPersonSar && out.maxPricePerPersonSar > 0 ? Math.round(out.maxPricePerPersonSar) : null;
  if (maxPrice) understood.push({ kind: "maxPrice", value: maxPrice });
  if (out.freeOnly) understood.push({ kind: "free" });
  if (out.upscale) understood.push({ kind: "upscale" });
  if (out.openNow) understood.push({ kind: "openNow" });
  const when =
    out.when === "none"
      ? null
      : out.when === "thursday" || out.when === "friday" || out.when === "saturday"
        ? { kind: "day" as const, weekday: out.when === "thursday" ? 4 : out.when === "friday" ? 5 : 6 }
        : { kind: out.when };
  if (when) understood.push({ kind: "when", value: when });
  const attrs = [...new Set(out.attributes)] as Attr[];
  attrs.forEach((a) => understood.push({ kind: "attr", value: a }));
  const occasions = [...new Set(out.occasions)];
  occasions.forEach((o) => understood.push({ kind: "occasion", value: o }));
  const hoodSlugs = [...new Set(out.neighbourhoodSlugs.filter((s) => hoods.has(s)))];
  hoodSlugs.forEach((h) => understood.push({ kind: "hood", value: h }));
  if (out.nearWaterfront) understood.push({ kind: "waterfront" });
  if (out.nearUser) understood.push({ kind: "nearMe" });
  if (out.thingsToDo) understood.push({ kind: "activities" });
  return {
    raw,
    text: out.nameKeywords.flatMap((k) => tokenize(k)).slice(0, 6),
    categories,
    subs,
    maxPrice,
    free: out.freeOnly,
    minLevel: out.upscale ? 3 : null,
    openNow: out.openNow,
    when,
    attrs,
    occasions,
    hoods: hoodSlugs,
    waterfront: out.nearWaterfront,
    nearMe: out.nearUser,
    activities: out.thingsToDo,
    understood,
  };
}
