import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { neighbourhoods, users } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { INTERESTS, PLACE_CATEGORIES } from "@/lib/taxonomy";

const Settings = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  avatarUrl: z
    .string()
    .regex(/^\/uploads\/avatars\/[A-Za-z0-9_-]+\.webp$/)
    .nullable()
    .optional(),
  locale: z.enum(["en", "ar"]).optional(),
  interests: z.array(z.enum(INTERESTS.map((i) => i.slug) as [string, ...string[]])).max(13).optional(),
  favoriteCategories: z.array(z.enum(PLACE_CATEGORIES.map((c) => c.slug) as [string, ...string[]])).max(12).optional(),
  budgetPreference: z.number().int().min(0).max(5000).nullable().optional(),
  homeNeighbourhood: z.string().max(80).nullable().optional(),
  privacy: z
    .object({ profilePublic: z.boolean(), showVisited: z.boolean(), showReviewsOnProfile: z.boolean(), personalize: z.boolean() })
    .optional(),
  notificationPrefs: z
    .object({
      savedEvents: z.boolean(),
      outingReminders: z.boolean(),
      eventChanges: z.boolean(),
      planInvites: z.boolean(),
      planActivity: z.boolean(),
      promotional: z.boolean(),
    })
    .optional(),
});

export const PATCH = handler(async (req: Request) => {
  const user = await mutationUser();
  const data = await body(req, Settings);
  if (data.homeNeighbourhood) {
    const [h] = await db.select({ slug: neighbourhoods.slug }).from(neighbourhoods).where(eq(neighbourhoods.slug, data.homeNeighbourhood));
    if (!h) throw new HttpError(400, "unknown_area");
  }
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, user.id));
  return json({ ok: true });
});
