import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { eventSaves, events } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";

const B = z.object({ eventId: z.string().min(1).max(64) });

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const { eventId } = await body(req, B);
  const [e] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.status, "published")));
  if (!e) throw new HttpError(404, "not_found");
  await db.insert(eventSaves).values({ userId: user.id, eventId }).onConflictDoNothing();
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  const user = await mutationUser();
  const { eventId } = await body(req, B);
  await db.delete(eventSaves).where(and(eq(eventSaves.userId, user.id), eq(eventSaves.eventId, eventId)));
  return json({ ok: true });
});
