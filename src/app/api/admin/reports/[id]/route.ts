import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places, reports } from "@/lib/db/schema";
import { HttpError, json } from "@/lib/api";
import { invalidateCatalog } from "@/lib/places/catalog";
import { adminHandler, adminMutation, FieldError, readJson, zodFields } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve"), resolution: z.string().trim().min(1, "note_required").max(500, "too_long") }),
  z.object({ action: z.literal("dismiss"), resolution: z.string().trim().min(1, "note_required").max(500, "too_long") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("flag_place") }),
]);

/** Resolve, dismiss or reopen a report; or flag the reported place as outdated. */
export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/reports/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const parsed = Action.safeParse(await readJson(req));
  if (!parsed.success) throw new FieldError(zodFields(parsed.error));
  const data = parsed.data;
  const [r] = await db.select().from(reports).where(eq(reports.id, id));
  if (!r) throw new HttpError(404, "not_found");

  if (data.action === "flag_place") {
    if (r.targetType !== "place") throw new HttpError(400, "not_a_place");
    const [p] = await db.select({ id: places.id }).from(places).where(eq(places.id, r.targetId));
    if (!p) throw new HttpError(404, "not_found");
    await db.update(places).set({ flaggedOutdated: true, updatedAt: new Date() }).where(eq(places.id, p.id));
    invalidateCatalog();
    await audit(user.id, "place.flag", { type: "place", id: p.id }, `from report ${id} (${r.reason})`);
    return json({ ok: true });
  }

  if (data.action === "reopen") {
    await db.update(reports).set({ status: "open", resolution: null, resolvedBy: null, resolvedAt: null }).where(eq(reports.id, id));
    await audit(user.id, "report.reopen", { type: "report", id });
    return json({ ok: true });
  }

  await db
    .update(reports)
    .set({ status: data.action === "resolve" ? "resolved" : "dismissed", resolution: data.resolution, resolvedBy: user.id, resolvedAt: new Date() })
    .where(eq(reports.id, id));
  await audit(user.id, `report.${data.action}`, { type: "report", id }, `${r.targetType}:${r.targetId} — ${data.resolution}`);
  return json({ ok: true });
});
