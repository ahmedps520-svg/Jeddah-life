import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { placeNotes, places } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";

export const PUT = handler(async (req: Request) => {
  const user = await mutationUser();
  const { placeId, body: text } = await body(req, z.object({ placeId: z.string().min(1).max(64), body: z.string().max(2000) }));
  const [p] = await db.select({ id: places.id }).from(places).where(eq(places.id, placeId));
  if (!p) throw new HttpError(404, "not_found");
  if (!text.trim()) {
    await db.delete(placeNotes).where(and(eq(placeNotes.userId, user.id), eq(placeNotes.placeId, placeId)));
  } else {
    await db
      .insert(placeNotes)
      .values({ userId: user.id, placeId, body: text })
      .onConflictDoUpdate({ target: [placeNotes.userId, placeNotes.placeId], set: { body: text, updatedAt: new Date() } });
  }
  return json({ ok: true });
});
