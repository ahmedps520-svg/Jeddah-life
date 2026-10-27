import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places, reports, reviews } from "@/lib/db/schema";
import { HttpError, json } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { invalidateCatalog } from "@/lib/places/catalog";
import { adminHandler, adminMutation, FieldError, readJson, zodFields } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";

const Moderate = z
  .object({
    action: z.enum(["hide", "unhide", "remove"]),
    note: z.string().trim().max(500, "too_long").default(""),
  })
  .refine((d) => d.action === "unhide" || d.note.length > 0, { message: "note_required", path: ["note"] });

const STATUS = { hide: "hidden", unhide: "published", remove: "removed" } as const;
const NOTICE = { hide: "hidden", unhide: "restored", remove: "removed" } as const;

/** Hide, restore or remove a review with a moderator note; the author is notified. */
export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/reviews/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const parsed = Moderate.safeParse(await readJson(req));
  if (!parsed.success) throw new FieldError(zodFields(parsed.error));
  const { action, note } = parsed.data;

  const [r] = await db
    .select({ id: reviews.id, userId: reviews.userId, status: reviews.status, placeId: reviews.placeId, slug: places.slug, nameEn: places.nameEn, nameAr: places.nameAr })
    .from(reviews)
    .innerJoin(places, eq(places.id, reviews.placeId))
    .where(eq(reviews.id, id));
  if (!r) throw new HttpError(404, "not_found");
  if (r.status === "removed" && action !== "unhide") throw new HttpError(409, "already_removed");

  const now = new Date();
  await db
    .update(reviews)
    .set({ status: STATUS[action], moderatorNote: note || null })
    .where(eq(reviews.id, id));

  // Hiding or removing a review settles the open reports about it.
  if (action !== "unhide") {
    await db
      .update(reports)
      .set({ status: "resolved", resolution: note, resolvedBy: user.id, resolvedAt: now })
      .where(and(eq(reports.targetType, "review"), eq(reports.targetId, id), eq(reports.status, "open")));
  }

  await notify(r.userId, "review_moderated", {
    reviewId: r.id,
    placeId: r.placeId,
    placeSlug: r.slug,
    placeNameEn: r.nameEn,
    placeNameAr: r.nameAr,
    action: NOTICE[action],
    note: note || null,
  });
  invalidateCatalog();
  await audit(user.id, `review.${action}`, { type: "review", id }, note || null);
  return json({ ok: true });
});
