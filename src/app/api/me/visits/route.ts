import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places, visits } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { cityToday } from "@/lib/i18n/format";

const B = z.object({ placeId: z.string().min(1).max(64) });

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const { placeId } = await body(req, B);
  const [p] = await db.select({ id: places.id }).from(places).where(eq(places.id, placeId));
  if (!p) throw new HttpError(404, "not_found");
  await db.insert(visits).values({ userId: user.id, placeId, visitedOn: cityToday() }).onConflictDoNothing();
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  const user = await mutationUser();
  const { placeId } = await body(req, B);
  await db.delete(visits).where(and(eq(visits.userId, user.id), eq(visits.placeId, placeId)));
  return json({ ok: true });
});
