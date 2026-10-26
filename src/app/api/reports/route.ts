import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, places, reports, reviews, submissions } from "@/lib/db/schema";
import { body, handler, HttpError, json } from "@/lib/api";
import { assertSameOrigin, getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { newId, sha256 } from "@/lib/auth/password";

const REASONS = [
  "closed", "wrong_location", "wrong_hours", "wrong_price", "wrong_contact", "wrong_details", "duplicate",
  "inappropriate", "spam", "misleading", "outdated", "something_else",
] as const;

const B = z.object({
  targetType: z.enum(["place", "review", "submission", "event"]),
  targetId: z.string().min(1).max(64),
  reason: z.enum(REASONS),
  details: z.string().trim().max(1000).optional(),
});

/** Anyone can report — signed in or not — with rate limits. */
export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  const user = await getCurrentUser();
  const data = await body(req, B);
  const h = await headers();
  const who = user ? `u:${user.id}` : `ip:${sha256((h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown").slice(0, 16)}`;
  if (!(await rateLimit(`report:${who}`, user ? 20 : 8, 3600))) throw new HttpError(429, "rate_limited");

  const table = { place: places, review: reviews, submission: submissions, event: events }[data.targetType];
  const [exists] = await db.select({ id: table.id }).from(table).where(eq(table.id, data.targetId));
  if (!exists) throw new HttpError(404, "not_found");

  await db.insert(reports).values({
    id: newId(),
    targetType: data.targetType,
    targetId: data.targetId,
    reason: data.reason,
    details: data.details || null,
    userId: user?.id ?? null,
  });
  return json({ ok: true });
});
