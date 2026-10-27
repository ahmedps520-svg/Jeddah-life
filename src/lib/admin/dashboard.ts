import "server-only";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, eventSaves, places, placeStats, reports, reviews, saves, searchLog, submissions, users } from "@/lib/db/schema";
import { cityToday } from "@/lib/i18n/format";

const n = sql<number>`count(*)`;
const one = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);
const DAY = 86_400_000;

/** Verified more than a year ago counts as stale. */
export const STALE_MS = 365 * DAY;

export function staleCondition(now = Date.now()) {
  return or(
    eq(places.flaggedOutdated, true),
    and(eq(places.verification, "verified"), lt(places.lastVerifiedAt, new Date(now - STALE_MS))),
  );
}

export type RankedPlace = { id: string; slug: string; nameEn: string | null; nameAr: string | null; status: string; value: number };

async function topPlaces(field: "views" | "saves", days: number): Promise<RankedPlace[]> {
  // day is a YYYY-MM-DD string in Jeddah time; "last N days" includes today.
  const since = cityToday(new Date(Date.now() - (days - 1) * DAY));
  const metric = field === "views" ? sql<number>`sum(${placeStats.views})` : sql<number>`sum(${placeStats.saves})`;
  const rows = await db
    .select({ id: places.id, slug: places.slug, nameEn: places.nameEn, nameAr: places.nameAr, status: places.status, value: metric })
    .from(placeStats)
    .innerJoin(places, eq(places.id, placeStats.placeId))
    .where(gte(placeStats.day, since))
    .groupBy(places.id)
    .having(sql`${metric} > 0`)
    .orderBy(desc(metric))
    .limit(10);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getDashboard(range: 7 | 30) {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const today = cityToday();

  const [
    usersN,
    adminsN,
    byStatus,
    byVerification,
    reviewsN,
    reviews30,
    savesN,
    eventSavesN,
    openReports,
    pendingSubs,
    upcomingEvents,
    topSearches,
    zeroSearches,
    viewed,
    saved,
    staleOld,
    staleFlagged,
    staleList,
  ] = await Promise.all([
    db.select({ n }).from(users).then(one),
    db.select({ n }).from(users).where(eq(users.role, "admin")).then(one),
    db.select({ k: places.status, n }).from(places).groupBy(places.status),
    db.select({ k: places.verification, n }).from(places).where(inArray(places.status, ["published", "draft"])).groupBy(places.verification),
    db.select({ n }).from(reviews).then(one),
    db.select({ n }).from(reviews).where(gte(reviews.createdAt, since30)).then(one),
    db.select({ n }).from(saves).then(one),
    db.select({ n }).from(eventSaves).then(one),
    db.select({ n }).from(reports).where(eq(reports.status, "open")).then(one),
    db.select({ n }).from(submissions).where(eq(submissions.status, "pending")).then(one),
    db.select({ n }).from(events).where(and(eq(events.status, "published"), gte(events.endDate, today))).then(one),
    db
      .select({
        normalized: searchLog.normalized,
        query: sql<string>`min(${searchLog.query})`,
        n,
        avg: sql<number>`avg(${searchLog.results})`,
      })
      .from(searchLog)
      .where(gte(searchLog.createdAt, since30))
      .groupBy(searchLog.normalized)
      .orderBy(desc(n))
      .limit(15),
    db
      .select({ normalized: searchLog.normalized, query: sql<string>`min(${searchLog.query})`, n })
      .from(searchLog)
      .where(and(gte(searchLog.createdAt, since30), eq(searchLog.results, 0)))
      .groupBy(searchLog.normalized)
      .orderBy(desc(n))
      .limit(10),
    topPlaces("views", range),
    topPlaces("saves", range),
    db
      .select({ n })
      .from(places)
      .where(and(eq(places.verification, "verified"), lt(places.lastVerifiedAt, new Date(now - STALE_MS)), inArray(places.status, ["published", "draft"])))
      .then(one),
    db.select({ n }).from(places).where(and(eq(places.flaggedOutdated, true), inArray(places.status, ["published", "draft"]))).then(one),
    db
      .select({
        id: places.id,
        slug: places.slug,
        nameEn: places.nameEn,
        nameAr: places.nameAr,
        lastVerifiedAt: places.lastVerifiedAt,
        flaggedOutdated: places.flaggedOutdated,
      })
      .from(places)
      .where(and(staleCondition(now), inArray(places.status, ["published", "draft"])))
      .orderBy(desc(places.flaggedOutdated), sql`${places.lastVerifiedAt} asc`)
      .limit(8),
  ]);

  const status = Object.fromEntries(byStatus.map((r) => [r.k, Number(r.n)])) as Record<string, number>;
  const verification = Object.fromEntries(byVerification.map((r) => [r.k, Number(r.n)])) as Record<string, number>;

  return {
    users: usersN,
    admins: adminsN,
    places: {
      published: status.published ?? 0,
      draft: status.draft ?? 0,
      archived: status.archived ?? 0,
      total: (status.published ?? 0) + (status.draft ?? 0) + (status.archived ?? 0),
    },
    verification: {
      verified: verification.verified ?? 0,
      unverified: verification.unverified ?? 0,
      community: verification.community ?? 0,
    },
    reviews: { total: reviewsN, last30: reviews30 },
    saves: savesN,
    eventSaves: eventSavesN,
    openReports,
    pendingSubs,
    upcomingEvents,
    topSearches: topSearches.map((r) => ({ ...r, n: Number(r.n), avg: Number(r.avg) })),
    zeroSearches: zeroSearches.map((r) => ({ ...r, n: Number(r.n) })),
    viewed,
    saved,
    stale: { old: staleOld, flagged: staleFlagged, list: staleList },
  };
}
