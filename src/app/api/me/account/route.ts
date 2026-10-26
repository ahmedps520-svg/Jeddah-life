import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";
import { invalidateCatalog } from "@/lib/places/catalog";

/**
 * Deletes the account. Foreign keys cascade to every personal record:
 * sessions, saves, collections, notes, visits, reviews, submissions,
 * itineraries, saved events, plan memberships, organised plans and
 * notifications. Reports keep no link to the user (set null).
 */
export const DELETE = handler(async (req: Request) => {
  const user = await mutationUser();
  const { confirm } = await body(req, z.object({ confirm: z.string() }));
  if (confirm !== "DELETE") throw new HttpError(400, "confirmation_required");
  await db.delete(users).where(eq(users.id, user.id));
  await destroySession();
  invalidateCatalog();
  return json({ ok: true });
});
