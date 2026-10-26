import { z } from "zod";

export const ReviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(2000),
  visitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => new Date(d) <= new Date(Date.now() + 86400000), "future_date")
    .nullable()
    .optional(),
  priceAssessment: z.enum(["lower", "as_expected", "higher"]).nullable().optional(),
  spentPerPerson: z.number().int().min(0).max(5000).nullable().optional(),
  photos: z
    .array(z.object({ url: z.string().regex(/^\/uploads\/reviews\/[A-Za-z0-9_-]+\.webp$/) }))
    .max(4)
    .optional(),
});
export type ReviewInput = z.infer<typeof ReviewInput>;
