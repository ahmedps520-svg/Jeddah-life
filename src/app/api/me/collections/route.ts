import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { collectionItems, collections, places } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { newId, randomToken } from "@/lib/auth/password";

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const placeId = new URL(req.url).searchParams.get("placeId");
  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      isPublic: collections.isPublic,
      count: sql<number>`(select count(*) from ${collectionItems} ci where ci.collection_id = ${collections.id})`,
      has: placeId
        ? sql<number>`(select count(*) from ${collectionItems} ci where ci.collection_id = ${collections.id} and ci.place_id = ${placeId})`
        : sql<number>`0`,
    })
    .from(collections)
    .where(eq(collections.userId, user.id))
    .orderBy(asc(collections.createdAt));
  return json({ collections: rows.map((r) => ({ ...r, count: Number(r.count), has: Number(r.has) > 0 })) });
});

const Create = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional(),
  isPublic: z.boolean().optional(),
  placeId: z.string().max(64).optional(),
});

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const data = await body(req, Create);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(collections).where(eq(collections.userId, user.id));
  if (Number(n) >= 100) throw new HttpError(400, "too_many");
  const id = newId();
  await db.insert(collections).values({
    id,
    userId: user.id,
    name: data.name,
    description: data.description || null,
    isPublic: !!data.isPublic,
    shareToken: data.isPublic ? randomToken(12) : null,
  });
  if (data.placeId) {
    const [p] = await db.select({ id: places.id }).from(places).where(eq(places.id, data.placeId));
    if (p) await db.insert(collectionItems).values({ collectionId: id, placeId: p.id, position: 0 });
  }
  return json({ id });
});

