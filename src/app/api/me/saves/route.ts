import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places, saves } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { bumpPlaceStat } from "@/lib/stats";

export const GET = handler(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ ids: [] });
  const rows = await db.select({ placeId: saves.placeId }).from(saves).where(eq(saves.userId, user.id));
  return json({ ids: rows.map((r) => r.placeId) });
});

const Body = z.object({ placeId: z.string().min(1).max(64) });

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const { placeId } = await body(req, Body);
  const [p] = await db.select({ id: places.id }).from(places).where(eq(places.id, placeId));
  if (!p) throw new HttpError(404, "not_found");
  const res = await db.insert(saves).values({ userId: user.id, placeId }).onConflictDoNothing();
  if (res.rowsAffected) await bumpPlaceStat(placeId, "saves");
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  const user = await mutationUser();
  const { placeId } = await body(req, Body);
  const res = await db.delete(saves).where(and(eq(saves.userId, user.id), eq(saves.placeId, placeId)));
  if (res.rowsAffected) await bumpPlaceStat(placeId, "saves", -1);
  return json({ ok: true });
});
