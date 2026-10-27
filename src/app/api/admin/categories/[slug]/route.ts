import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { HttpError, json } from "@/lib/api";
import { adminHandler, adminMutation, FieldError, readJson, zodFields } from "@/lib/admin/api";
import { invalidateCatalog } from "@/lib/places/catalog";
import { audit, changedKeys } from "@/lib/admin/audit";
import { isHexColor } from "@/lib/admin/validate";

const t = (max: number) => z.string().trim().max(max, "too_long");

const Category = z.object({
  nameEn: t(60).min(1, "required"),
  nameAr: t(60).min(1, "required"),
  taglineEn: t(160),
  taglineAr: t(160),
  color: z.string().trim().refine(isHexColor, "color"),
  sortOrder: z.union([z.string(), z.number()]).transform((v, ctx) => {
    const n = typeof v === "number" ? v : /^-?\d+$/.test(v.trim()) ? Number(v.trim()) : Number.NaN;
    if (!Number.isInteger(n) || Math.abs(n) > 10_000) {
      ctx.addIssue({ code: "custom", message: "sort_order" });
      return z.NEVER;
    }
    return n;
  }),
  showOnHome: z.boolean(),
});

/** Edit a category's display fields. The slug itself is fixed. */
export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/categories/[slug]">) => {
  const user = await adminMutation();
  const { slug } = await ctx.params;
  const [existing] = await db.select().from(categories).where(eq(categories.slug, slug));
  if (!existing) throw new HttpError(404, "not_found");
  const parsed = Category.safeParse(await readJson(req));
  if (!parsed.success) throw new FieldError(zodFields(parsed.error));
  const d = parsed.data;
  const values = {
    nameEn: d.nameEn,
    nameAr: d.nameAr,
    taglineEn: d.taglineEn || null,
    taglineAr: d.taglineAr || null,
    color: d.color.toUpperCase(),
    sortOrder: d.sortOrder,
    showOnHome: d.showOnHome,
  };
  await db.update(categories).set(values).where(eq(categories.slug, slug));
  invalidateCatalog();
  await audit(user.id, "category.update", { type: "category", id: slug }, changedKeys(existing, values).join(", ") || null);
  return json({ ok: true });
});
