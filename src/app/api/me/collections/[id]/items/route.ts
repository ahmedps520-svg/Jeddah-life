import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { collectionItems, collections, places } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { ownCollection } from "@/lib/collections";

const One = z.object({ placeId: z.string().min(1).max(64), note: z.string().max(280).optional() });

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/me/collections/[id]/items">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  await ownCollection(user.id, id);
  const { placeId, note } = await body(req, One);
  const [p] = await db.select({ id: places.id }).from(places).where(eq(places.id, placeId));
  if (!p) throw new HttpError(404, "place_not_found");
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${collectionItems.position}), -1)` })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, id));
  await db
    .insert(collectionItems)
    .values({ collectionId: id, placeId, note: note ?? null, position: Number(max) + 1 })
    .onConflictDoNothing();
  await db.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, id));
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request, ctx: RouteContext<"/api/me/collections/[id]/items">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  await ownCollection(user.id, id);
  const { placeId } = await body(req, One);
  await db.delete(collectionItems).where(and(eq(collectionItems.collectionId, id), eq(collectionItems.placeId, placeId)));
  return json({ ok: true });
});

/** Reorder: the full list of place ids in the new order. */
export const PUT = handler(async (req: Request, ctx: RouteContext<"/api/me/collections/[id]/items">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  await ownCollection(user.id, id);
  const { placeIds } = await body(req, z.object({ placeIds: z.array(z.string().max(64)).max(500) }));
  for (const [i, placeId] of placeIds.entries()) {
    await db
      .update(collectionItems)
      .set({ position: i })
      .where(and(eq(collectionItems.collectionId, id), eq(collectionItems.placeId, placeId)));
  }
  return json({ ok: true });
});
