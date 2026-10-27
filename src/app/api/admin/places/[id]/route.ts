import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { body, HttpError, json } from "@/lib/api";
import { invalidateCatalog } from "@/lib/places/catalog";
import { adminHandler, adminMutation, readJson } from "@/lib/admin/api";
import { validatePlace } from "@/lib/admin/places";
import { audit, changedKeys } from "@/lib/admin/audit";

async function load(id: string) {
  const [p] = await db.select().from(places).where(eq(places.id, id));
  if (!p) throw new HttpError(404, "not_found");
  return p;
}

/** Update a place from the full edit form. */
export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/places/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const existing = await load(id);
  const { values, markVerified } = await validatePlace(await readJson(req), existing);
  await db.update(places).set(values).where(eq(places.id, id));
  invalidateCatalog();
  const changed = changedKeys(existing as unknown as Record<string, unknown>, values as Record<string, unknown>).filter(
    (k) => !["updatedAt", "hoursCheckedAt", "priceCheckedAt", "lastVerifiedAt"].includes(k),
  );
  await audit(user.id, markVerified ? "place.update+verify" : "place.update", { type: "place", id }, changed.length ? changed.join(", ") : null);
  return json({ ok: true });
});

/** Permanent deletion — only with the slug typed as confirmation. */
export const DELETE = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/places/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const existing = await load(id);
  const { confirm } = await body(req, z.object({ confirm: z.string().max(200) }));
  if (confirm.trim() !== existing.slug) throw new HttpError(400, "confirm_mismatch");
  await db.delete(places).where(eq(places.id, id));
  invalidateCatalog();
  await audit(user.id, "place.delete", { type: "place", id }, `${existing.slug} — ${existing.nameEn ?? existing.nameAr ?? ""}`);
  return json({ ok: true });
});
