import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  collectionItems, collections, eventSaves, hiddenRecommendations, interactions, itineraries, notifications,
  placeNotes, planParticipants, reviews, saves, submissions, users, visits,
} from "@/lib/db/schema";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

/** Everything stored about the signed-in user, as a JSON download. */
export const GET = handler(async () => {
  const user = await requireUser();
  const id = user.id;
  const [profile] = await db.select().from(users).where(eq(users.id, id));
  const cols = await db.select().from(collections).where(eq(collections.userId, id));
  const data = {
    exportedAt: new Date().toISOString(),
    profile: { ...profile, passwordHash: undefined },
    saves: await db.select().from(saves).where(eq(saves.userId, id)),
    collections: cols,
    collectionItems: cols.length ? await db.select().from(collectionItems).where(inArray(collectionItems.collectionId, cols.map((c) => c.id))) : [],
    notes: await db.select().from(placeNotes).where(eq(placeNotes.userId, id)),
    visits: await db.select().from(visits).where(eq(visits.userId, id)),
    reviews: await db.select().from(reviews).where(eq(reviews.userId, id)),
    submissions: await db.select().from(submissions).where(eq(submissions.userId, id)),
    itineraries: await db.select().from(itineraries).where(eq(itineraries.userId, id)),
    savedEvents: await db.select().from(eventSaves).where(eq(eventSaves.userId, id)),
    sharedPlanMemberships: await db.select().from(planParticipants).where(eq(planParticipants.userId, id)),
    hiddenRecommendations: await db.select().from(hiddenRecommendations).where(eq(hiddenRecommendations.userId, id)),
    activity: await db.select().from(interactions).where(eq(interactions.userId, id)),
    notifications: await db.select().from(notifications).where(eq(notifications.userId, id)),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jeddah-life-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
