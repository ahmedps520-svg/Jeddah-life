import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { invalidateCatalog } from "@/lib/places/catalog";
import { ReviewInput } from "@/lib/reviews";

async function own(id: string, userId: string, admin: boolean) {
  const [r] = await db.select().from(reviews).where(eq(reviews.id, id));
  if (!r) throw new HttpError(404, "not_found");
  if (r.userId !== userId && !admin) throw new HttpError(403, "forbidden");
  return r;
}

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/reviews/[id]">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  const r = await own(id, user.id, false);
  if (r.status === "removed") throw new HttpError(403, "removed");
  const data = await body(req, ReviewInput);
  await db
    .update(reviews)
    .set({
      rating: data.rating,
      body: data.body,
      visitDate: data.visitDate ?? null,
      priceAssessment: data.priceAssessment ?? null,
      spentPerPerson: data.spentPerPerson ?? null,
      photos: (data.photos ?? []).map((ph) => ({ url: ph.url, origin: "upload", author: user.displayName })),
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, id));
  invalidateCatalog();
  return json({ ok: true });
});

export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/reviews/[id]">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  await own(id, user.id, user.role === "admin");
  await db.delete(reviews).where(eq(reviews.id, id));
  invalidateCatalog();
  return json({ ok: true });
});
