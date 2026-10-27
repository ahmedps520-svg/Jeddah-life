import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { neighbourhoods, places, submissions, users, type ImageCredit } from "@/lib/db/schema";
import { HttpError, json } from "@/lib/api";
import { newId } from "@/lib/auth/password";
import { notify } from "@/lib/notifications";
import { invalidateCatalog } from "@/lib/places/catalog";
import { PLACE_CATEGORIES, SUBCATEGORIES } from "@/lib/taxonomy";
import { adminHandler, adminMutation, FieldError, readJson, zodFields } from "@/lib/admin/api";
import { checkCoords, nearestHood, uniqueSlug } from "@/lib/admin/places";
import { audit } from "@/lib/admin/audit";
import type { FieldErrors } from "@/lib/admin/types";

const t = (max: number) => z.string().trim().max(max, "too_long").default("");

const Gem = { gemNoteEn: t(600), gemNoteAr: t(600), note: t(500) };

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve_link"), placeId: z.string().min(1, "required").max(64), ...Gem }),
  z.object({
    action: z.literal("approve_create"),
    nameEn: t(160),
    nameAr: t(160),
    category: t(40),
    subcategory: t(80),
    lat: t(30),
    lng: t(30),
    neighbourhood: t(120),
    descriptionEn: t(5000),
    descriptionAr: t(5000),
    usePhotos: z.boolean().default(false),
    ...Gem,
  }),
  z.object({ action: z.literal("reject"), note: z.string().trim().min(1, "note_required").max(500, "too_long") }),
]);

/**
 * Review a community submission:
 *  - approve by linking an existing place (it becomes a hidden gem with the note), or
 *  - approve by creating a new community place (published, labelled as community), or
 *  - reject with a note.
 * The submitter is notified either way.
 */
export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/submissions/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const parsed = Action.safeParse(await readJson(req));
  if (!parsed.success) throw new FieldError(zodFields(parsed.error));
  const data = parsed.data;

  const [sub] = await db.select().from(submissions).where(eq(submissions.id, id));
  if (!sub) throw new HttpError(404, "not_found");
  if (sub.status !== "pending") throw new HttpError(409, "already_reviewed");
  const now = new Date();

  if (data.action === "reject") {
    await db
      .update(submissions)
      .set({ status: "rejected", moderatorNote: data.note, reviewedBy: user.id, reviewedAt: now })
      .where(eq(submissions.id, id));
    await notify(sub.userId, "submission_reviewed", { submissionId: id, name: sub.name, status: "rejected", note: data.note, placeSlug: null });
    await audit(user.id, "submission.reject", { type: "submission", id }, data.note);
    return json({ ok: true });
  }

  const e: FieldErrors = {};
  if (!data.gemNoteEn && !data.gemNoteAr) e.gemNoteEn = "gem_note";

  let placeId: string;
  let placeSlug: string;

  if (data.action === "approve_link") {
    const [p] = await db.select({ id: places.id, slug: places.slug }).from(places).where(eq(places.id, data.placeId));
    if (!p) e.placeId = "place_not_found";
    if (Object.keys(e).length) throw new FieldError(e);
    placeId = p!.id;
    placeSlug = p!.slug;
    await db
      .update(places)
      .set({ hiddenGem: true, hiddenGemNoteEn: data.gemNoteEn || null, hiddenGemNoteAr: data.gemNoteAr || null, updatedAt: now })
      .where(eq(places.id, placeId));
  } else {
    if (!data.nameEn && !data.nameAr) e.nameEn = "name_required";
    if (!PLACE_CATEGORIES.some((c) => c.slug === data.category)) e.category = data.category ? "category" : "required";
    if (data.subcategory && !SUBCATEGORIES[data.subcategory]) e.subcategory = "subcategory";
    const { lat, lng } = checkCoords(data.lat, data.lng, e);
    if (data.neighbourhood) {
      const [h] = await db.select({ slug: neighbourhoods.slug }).from(neighbourhoods).where(eq(neighbourhoods.slug, data.neighbourhood));
      if (!h) e.neighbourhood = "neighbourhood";
    }
    if (Object.keys(e).length) throw new FieldError(e);

    const [submitter] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, sub.userId));
    const images: ImageCredit[] = data.usePhotos
      ? (sub.photos ?? []).map((ph) => ({
          url: ph.url,
          width: ph.width,
          height: ph.height,
          author: submitter?.displayName ?? null,
          license: "Shared by the submitter",
          origin: "upload",
        }))
      : [];
    placeId = `cm_${newId()}`;
    placeSlug = await uniqueSlug("places", data.nameEn, "place");
    await db.insert(places).values({
      id: placeId,
      slug: placeSlug,
      nameEn: data.nameEn || null,
      nameAr: data.nameAr || null,
      category: data.category,
      subcategory: data.subcategory || null,
      descriptionEn: data.descriptionEn || null,
      descriptionAr: data.descriptionAr || null,
      lat,
      lng,
      neighbourhood: data.neighbourhood || (await nearestHood(lat, lng)),
      images,
      source: "community",
      sourceRef: `submission:${id}`,
      sourceDetail: `Community submission reviewed by an administrator`,
      verification: "community",
      status: "published",
      hiddenGem: true,
      hiddenGemNoteEn: data.gemNoteEn || null,
      hiddenGemNoteAr: data.gemNoteAr || null,
    });
  }

  await db
    .update(submissions)
    .set({ status: "approved", placeId, moderatorNote: data.note || null, reviewedBy: user.id, reviewedAt: now })
    .where(eq(submissions.id, id));
  invalidateCatalog();
  await notify(sub.userId, "submission_reviewed", { submissionId: id, name: sub.name, status: "approved", note: data.note || null, placeSlug });
  await audit(user.id, data.action === "approve_link" ? "submission.approve_link" : "submission.approve_create", { type: "submission", id }, `place ${placeSlug}`);
  return json({ ok: true, placeId, placeSlug });
});
