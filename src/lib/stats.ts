import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { interactions, placeStats } from "@/lib/db/schema";
import { cityToday } from "@/lib/i18n/format";
import type { SessionUser } from "@/lib/auth/session";

/** Anonymous daily counters per place (no user identifiers). */
export async function bumpPlaceStat(placeId: string, field: "views" | "saves" | "plans", by = 1) {
  const day = cityToday();
  await db
    .insert(placeStats)
    .values({ placeId, day, views: 0, saves: 0, plans: 0, [field]: Math.max(0, by) })
    .onConflictDoUpdate({
      target: [placeStats.placeId, placeStats.day],
      set: { [field]: sql`max(0, ${placeStats[field]} + ${by})` },
    })
    .catch(() => {});
}

/** Personal history, only when the user allows personalisation. */
export async function recordInteraction(user: SessionUser | null, kind: "view" | "search" | "plan", data: { placeId?: string; query?: string }) {
  if (!user || user.privacy?.personalize === false) return;
  await db
    .insert(interactions)
    .values({ userId: user.id, kind, placeId: data.placeId ?? null, query: data.query ?? null })
    .catch(() => {});
}
