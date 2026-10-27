import { z } from "zod";

export const SettingsSchema = z.object({
  groupType: z.enum(["solo", "couple", "friends", "family", "large", "custom"]),
  groupSize: z.number().int().min(1).max(50),
  budget: z.number().min(0).max(100000).nullable(),
  budgetMode: z.enum(["per_person", "group"]),
  interests: z.array(z.string().max(30)).max(13),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.number().int().min(30).max(16 * 60),
  start: z
    .object({ lat: z.number().min(21).max(22.3), lng: z.number().min(38.8).max(39.6), label: z.string().max(80).optional() })
    .nullable(),
  transport: z.enum(["car", "ride", "walk"]),
});

export const StopsSchema = z
  .array(
    z.object({
      placeId: z.string().min(1).max(64),
      kind: z.enum(["coffee", "meal", "dessert", "activity", "scenic", "culture", "shopping", "custom"]),
      durationMin: z.number().int().min(10).max(600).optional(),
    }),
  )
  .max(10);
