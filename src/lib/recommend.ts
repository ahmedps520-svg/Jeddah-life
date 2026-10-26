import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { hiddenRecommendations, interactions, places, saves, visits } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import type { Catalog } from "@/lib/places/catalog";
import type { PlaceLite } from "@/lib/places/types";
import { haversineKm } from "@/lib/places/estimates";
import { inCategory } from "@/lib/search/engine";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { INTERESTS, categoryDef } from "@/lib/taxonomy";

/**
 * Content-based recommendations with an explanation for every pick.
 *
 * Signals (only those the user actually gave us): chosen interests and
 * favourite categories, saved places, recent views and searches (if
 * personalisation is on), budget preference and home area. If none of
 * these exist we return null and the caller shows editorial picks
 * instead of pretending to know the user's taste.
 */

const INTEREST_MATCH: Record<string, (p: PlaceLite) => boolean> = {
  food: (p) => p.category === "restaurants",
  coffee: (p) => p.category === "cafes" && !/ice_cream|dessert|donut|bakery|chocolatier|juice/.test(p.sub ?? ""),
  shopping: (p) => inCategory(p, "shopping"),
  adventure: (p) => inCategory(p, "adventure"),
  beaches: (p) => inCategory(p, "beaches"),
  gaming: (p) => /escape_room|arcade|bowling|games/.test(p.sub ?? ""),
  sports: (p) => inCategory(p, "sports"),
  culture: (p) => inCategory(p, "culture"),
  photography: (p) => p.attrs.photo === true,
  entertainment: (p) => inCategory(p, "entertainment"),
  relaxation: (p) => ["outdoors", "beaches"].includes(p.category) || p.attrs.quiet === true,
  family: (p) => inCategory(p, "family"),
  luxury: (p) => (p.level ?? 0) >= 3,
};

export type Reason =
  | { kind: "interest"; value: string }
  | { kind: "category"; value: string }
  | { kind: "saved" }
  | { kind: "near"; value: string }
  | { kind: "budget"; value: number };

export type Recommendation = { place: PlaceLite; reasons: Reason[] };

export async function recommendFor(
  user: SessionUser,
  catalog: Catalog,
  opts: { limit?: number; exclude?: string[] } = {},
): Promise<Recommendation[] | null> {
  const personalize = user.privacy?.personalize !== false;
  const [savedRows, hiddenRows, visitedRows, recent] = await Promise.all([
    db.select({ placeId: saves.placeId }).from(saves).where(eq(saves.userId, user.id)),
    db.select({ placeId: hiddenRecommendations.placeId }).from(hiddenRecommendations).where(eq(hiddenRecommendations.userId, user.id)),
    db.select({ placeId: visits.placeId }).from(visits).where(eq(visits.userId, user.id)),
    personalize
      ? db
          .select({ placeId: interactions.placeId })
          .from(interactions)
          .where(and(eq(interactions.userId, user.id), eq(interactions.kind, "view"), gte(interactions.createdAt, new Date(Date.now() - 30 * 86400000))))
          .orderBy(desc(interactions.createdAt))
          .limit(60)
      : Promise.resolve([] as { placeId: string | null }[]),
  ]);

  const savedPlaces = savedRows.map((r) => catalog.byId.get(r.placeId)).filter(Boolean) as PlaceLite[];
  const viewed = recent.map((r) => (r.placeId ? catalog.byId.get(r.placeId) : undefined)).filter(Boolean) as PlaceLite[];
  const interests = user.interests ?? [];
  const favCats = user.favoriteCategories ?? [];
  const hasSignal = interests.length > 0 || favCats.length > 0 || savedPlaces.length > 0 || viewed.length >= 3;
  if (!hasSignal) return null;

  // Category/sub-type affinity from saved and viewed places.
  const affinity = new Map<string, number>();
  for (const p of savedPlaces) affinity.set(p.sub ?? p.category, (affinity.get(p.sub ?? p.category) ?? 0) + 3);
  for (const p of viewed) affinity.set(p.sub ?? p.category, (affinity.get(p.sub ?? p.category) ?? 0) + 1);

  const exclude = new Set([...(opts.exclude ?? []), ...hiddenRows.map((r) => r.placeId), ...savedRows.map((r) => r.placeId), ...visitedRows.map((r) => r.placeId)]);
  const home = user.homeNeighbourhood ? catalog.hoodBySlug.get(user.homeNeighbourhood) : null;
  const budget = user.budgetPreference ?? null;
  // Day-seeded jitter so the list changes over time without being random on every refresh.
  const day = Math.floor(Date.now() / 86400000);

  const scored: Array<Recommendation & { score: number }> = [];
  for (const p of catalog.places) {
    if (exclude.has(p.id)) continue;
    const reasons: Reason[] = [];
    let score = 0;
    for (const i of interests) {
      if (INTEREST_MATCH[i]?.(p)) {
        score += 10;
        if (!reasons.some((r) => r.kind === "interest")) reasons.push({ kind: "interest", value: i });
      }
    }
    for (const c of favCats) {
      if (inCategory(p, c)) {
        score += 7;
        if (!reasons.some((r) => r.kind === "interest" || r.kind === "category")) reasons.push({ kind: "category", value: c });
      }
    }
    const aff = affinity.get(p.sub ?? p.category) ?? 0;
    if (aff) {
      score += Math.min(12, aff * 2);
      if (savedPlaces.length && !reasons.some((r) => r.kind === "saved")) reasons.push({ kind: "saved" });
    }
    if (score === 0) continue;
    if (home && haversineKm({ lat: home.center[0], lng: home.center[1] }, p) < 3) {
      score += 4;
      reasons.push({ kind: "near", value: home.slug });
    }
    if (budget != null && p.cost.planning != null) {
      if (p.cost.planning <= budget) {
        score += 5;
        reasons.push({ kind: "budget", value: budget });
      } else if (p.cost.planning > budget * 1.5) score -= 8;
    }
    if (p.ver === "verified") score += 4;
    if (p.img) score += 3;
    if (p.chain) score -= 6;
    score += ((p.id.charCodeAt(3) * 31 + day) % 7) * 0.6;
    scored.push({ place: p, reasons, score });
  }
  scored.sort((a, b) => b.score - a.score);

  // Diversity: at most 3 per category and 1 per brand.
  const out: Recommendation[] = [];
  const perCat = new Map<string, number>();
  const brands = new Set<string>();
  for (const s of scored) {
    const c = s.place.category;
    if ((perCat.get(c) ?? 0) >= 3) continue;
    if (s.place.brand && brands.has(s.place.brand)) continue;
    perCat.set(c, (perCat.get(c) ?? 0) + 1);
    if (s.place.brand) brands.add(s.place.brand);
    out.push({ place: s.place, reasons: s.reasons });
    if (out.length >= (opts.limit ?? 12)) break;
  }
  return out;
}

/** Render "Recommended because you enjoy cafés and it fits your usual budget (up to 50 SAR)." */
export function explain(
  reasons: Reason[],
  locale: Locale,
  t: { because: string; enjoy: string; savedSimilar: string; nearHome: string; budget: string; and: string },
  hoodName: (slug: string) => string,
): string | null {
  // Most telling reason first: taste, then budget, then saved places, then area.
  const order: Reason["kind"][] = ["interest", "category", "budget", "saved", "near"];
  const picked = [...reasons].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, 2);
  const parts = picked.map((r) => {
    switch (r.kind) {
      case "interest": {
        const label = INTERESTS.find((i) => i.slug === r.value)?.name[locale] ?? r.value;
        return t.enjoy.replace("{x}", locale === "en" ? label.toLowerCase() : label);
      }
      case "category": {
        const label = categoryDef(r.value).name[locale];
        return t.enjoy.replace("{x}", locale === "en" ? label.toLowerCase() : label);
      }
      case "saved":
        return t.savedSimilar;
      case "near":
        return t.nearHome.replace("{area}", hoodName(r.value));
      case "budget":
        return t.budget.replace("{n}", formatNumber(locale, r.value));
    }
  });
  if (!parts.length) return null;
  return t.because.replace("{reasons}", parts.join(t.and));
}

/** Places saved or voted for by people the user has planned outings with. */
export async function popularWithPlanningFriends(userId: string, catalog: Catalog, limit = 12): Promise<PlaceLite[]> {
  const { planParticipants, planVotes, planOptions } = await import("@/lib/db/schema");
  const myPlans = await db.select({ planId: planParticipants.planId }).from(planParticipants).where(eq(planParticipants.userId, userId));
  if (!myPlans.length) return [];
  const others = await db
    .select({ userId: planParticipants.userId, id: planParticipants.id })
    .from(planParticipants)
    .where(inArray(planParticipants.planId, myPlans.map((p) => p.planId)));
  const friendIds = [...new Set(others.map((o) => o.userId).filter((u): u is string => !!u && u !== userId))];
  const friendParticipantIds = others.filter((o) => o.userId && o.userId !== userId).map((o) => o.id);
  const counts = new Map<string, number>();
  if (friendIds.length) {
    const fs = await db.select({ placeId: saves.placeId }).from(saves).where(inArray(saves.userId, friendIds));
    for (const r of fs) counts.set(r.placeId, (counts.get(r.placeId) ?? 0) + 1);
  }
  if (friendParticipantIds.length) {
    const votes = await db
      .select({ placeId: planOptions.placeId })
      .from(planVotes)
      .innerJoin(planOptions, eq(planOptions.id, planVotes.optionId))
      .where(and(inArray(planVotes.participantId, friendParticipantIds), eq(planVotes.value, 1)));
    for (const v of votes) if (v.placeId) counts.set(v.placeId, (counts.get(v.placeId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => catalog.byId.get(id))
    .filter((p): p is PlaceLite => !!p)
    .slice(0, limit);
}

export async function hideRecommendation(userId: string, placeId: string) {
  const [exists] = await db.select({ id: places.id }).from(places).where(eq(places.id, placeId));
  if (!exists) return;
  await db.insert(hiddenRecommendations).values({ userId, placeId }).onConflictDoNothing();
}
