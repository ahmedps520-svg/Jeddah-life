import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { heroSlides } from "@/lib/db/schema";
import { HttpError, json } from "@/lib/api";
import { adminHandler, adminMutation, readJson } from "@/lib/admin/api";
import { validateHero } from "@/lib/admin/hero";
import { audit, changedKeys } from "@/lib/admin/audit";

async function load(id: string) {
  const [h] = await db.select().from(heroSlides).where(eq(heroSlides.id, id));
  if (!h) throw new HttpError(404, "not_found");
  return h;
}

export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/hero/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const existing = await load(id);
  const values = validateHero(await readJson(req));
  await db.update(heroSlides).set(values).where(eq(heroSlides.id, id));
  await audit(user.id, "hero.update", { type: "hero", id }, changedKeys(existing, values).join(", ") || null);
  return json({ ok: true });
});

export const DELETE = adminHandler(async (_req: Request, ctx: RouteContext<"/api/admin/hero/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const existing = await load(id);
  await db.delete(heroSlides).where(eq(heroSlides.id, id));
  await audit(user.id, "hero.delete", { type: "hero", id }, existing.titleEn);
  return json({ ok: true });
});
