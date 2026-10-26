import { and, eq, gte, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places, reviews } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { newId } from "@/lib/auth/password";
import { invalidateCatalog } from "@/lib/places/catalog";
import { ReviewInput } from "@/lib/reviews";

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const data = await body(req, ReviewInput.extend({ placeId: z.string().min(1).max(64) }));
  const [p] = await db.select({ id: places.id, status: places.status }).from(places).where(eq(places.id, data.placeId));
  if (!p || p.status !== "published") throw new HttpError(404, "not_found");

  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, user.id), eq(reviews.placeId, p.id)));
  if (existing) throw new HttpError(409, "duplicate", existing.id);

  // Copy-pasting the same text across places is the most common abuse pattern.
  const recent = await db
    .select({ body: reviews.body })
    .from(reviews)
    .where(and(eq(reviews.userId, user.id), ne(reviews.placeId, p.id), gte(reviews.createdAt, new Date(Date.now() - 30 * 86400000))));
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (recent.some((r) => norm(r.body) === norm(data.body))) throw new HttpError(409, "duplicate_text");

  if (!(await rateLimit(`review:h:${user.id}`, 5, 3600)) || !(await rateLimit(`review:d:${user.id}`, 15, 86400))) {
    throw new HttpError(429, "rate_limited");
  }

  const id = newId();
  await db.insert(reviews).values({
    id,
    placeId: p.id,
    userId: user.id,
    rating: data.rating,
    body: data.body,
    visitDate: data.visitDate ?? null,
    priceAssessment: data.priceAssessment ?? null,
    spentPerPerson: data.spentPerPerson ?? null,
    photos: (data.photos ?? []).map((ph) => ({ url: ph.url, origin: "upload", author: user.displayName })),
  });
  invalidateCatalog();
  return json({ id });
});
