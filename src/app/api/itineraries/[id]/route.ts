import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { itineraries } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { randomToken } from "@/lib/auth/password";
import { getCatalog } from "@/lib/places/catalog";
import { evaluate } from "@/lib/planner/engine";
import { SettingsSchema, StopsSchema } from "@/lib/planner/schema";

async function own(id: string, userId: string) {
  const [it] = await db.select().from(itineraries).where(and(eq(itineraries.id, id), eq(itineraries.userId, userId)));
  if (!it) throw new HttpError(404, "not_found");
  return it;
}

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/itineraries/[id]">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  const it = await own(id, user.id);
  const data = await body(
    req,
    z.object({ title: z.string().trim().min(1).max(80).optional(), settings: SettingsSchema.optional(), stops: StopsSchema.optional(), share: z.boolean().optional() }),
  );
  const patch: Partial<typeof itineraries.$inferInsert> = { updatedAt: new Date() };
  if (data.title) patch.title = data.title;
  if (data.settings && data.stops) {
    const s = data.settings;
    const plan = evaluate(await getCatalog(), s, data.stops);
    Object.assign(patch, {
      date: s.date,
      startTime: s.startTime,
      durationMin: s.durationMin,
      groupType: s.groupType,
      groupSize: s.groupSize,
      budget: s.budget == null ? null : Math.round(s.budget),
      budgetMode: s.budgetMode,
      interests: s.interests,
      transport: s.transport,
      startLabel: s.start?.label ?? null,
      startLat: s.start?.lat ?? null,
      startLng: s.start?.lng ?? null,
      remindedAt: null,
      stops: plan.stops.map((st, i) => ({ id: `${i}`, placeId: st.placeId, durationMin: st.durationMin, costPerPerson: st.cost.perPerson, costBasis: st.cost.basis, note: st.kind })),
    });
  }
  if (data.share !== undefined) patch.shareToken = data.share ? (it.shareToken ?? randomToken(12)) : null;
  await db.update(itineraries).set(patch).where(eq(itineraries.id, id));
  const [after] = await db.select({ shareToken: itineraries.shareToken }).from(itineraries).where(eq(itineraries.id, id));
  return json({ ok: true, shareToken: after?.shareToken ?? null });
});

export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/itineraries/[id]">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  await own(id, user.id);
  await db.delete(itineraries).where(eq(itineraries.id, id));
  return json({ ok: true });
});
