import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { planParticipants, sharedPlans, type ItineraryStop } from "@/lib/db/schema";
import { body, handler, HttpError, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/session";
import { getCatalog } from "@/lib/places/catalog";
import { typicalDuration } from "@/lib/places/estimates";
import { bump, currentParticipant, notifyPlan, planByCode, planState, requireParticipant } from "@/lib/together";

/**
 * Current state of a shared plan. Clients poll with ?v=<version>; when nothing
 * changed the response is tiny. Non-participants only get a preview to join.
 */
export const GET = handler(async (req: Request, ctx: RouteContext<"/api/together/[code]">) => {
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  const me = await currentParticipant(plan);
  const v = Number(new URL(req.url).searchParams.get("v"));
  if (me && v === plan.version) return json({ unchanged: true, version: plan.version }, { headers: { "Cache-Control": "no-store" } });
  if (!me) {
    const people = await db.select({ id: planParticipants.id }).from(planParticipants).where(eq(planParticipants.planId, plan.id));
    return json({ preview: { title: plan.title, status: plan.status, participants: people.length } }, { headers: { "Cache-Control": "no-store" } });
  }
  return json(await planState(await getCatalog(), plan, me), { headers: { "Cache-Control": "no-store" } });
});

const Patch = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  budgetPerPerson: z.number().int().min(0).max(100000).nullable().optional(),
  status: z.enum(["planning", "cancelled"]).optional(),
  finalize: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d)?$/),
      placeIds: z.array(z.string().max(64)).min(1).max(8),
    })
    .optional(),
});

/** Organiser controls: edit details, set the budget, finalise, reopen or cancel. */
export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/together/[code]">) => {
  await assertSameOrigin();
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  const me = await requireParticipant(plan);
  if (me.role !== "organizer") throw new HttpError(403, "organizer_only");
  const data = await body(req, Patch);

  const patch: Partial<typeof sharedPlans.$inferInsert> = {};
  if (data.title) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.budgetPerPerson !== undefined) patch.budgetPerPerson = data.budgetPerPerson;
  if (data.status) {
    patch.status = data.status;
    if (data.status === "planning") {
      patch.finalDate = null;
      patch.finalStops = null;
    }
  }
  let finalized = false;
  if (data.finalize) {
    const catalog = await getCatalog();
    const stops: ItineraryStop[] = [];
    for (const id of [...new Set(data.finalize.placeIds)]) {
      const p = catalog.byId.get(id);
      if (!p) throw new HttpError(400, "unknown_place");
      stops.push({
        id: `${stops.length}`,
        placeId: p.id,
        durationMin: typicalDuration(p.category, p.sub),
        costPerPerson: p.cost.planning,
        costBasis: p.cost.basis === "free" ? "free" : p.cost.basis === "verified" ? "verified" : p.cost.planning == null ? "unknown" : "estimate",
      });
    }
    Object.assign(patch, { status: "final", finalDate: data.finalize.date, finalStops: stops });
    finalized = true;
  }
  await db.update(sharedPlans).set(patch).where(eq(sharedPlans.id, plan.id));
  await bump(plan.id);
  if (finalized) await notifyPlan({ ...plan, ...patch }, me, "plan_final", { dedupe: data.finalize!.date });
  return json({ ok: true });
});

/** Organiser deletes the plan for everyone. */
export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/together/[code]">) => {
  await assertSameOrigin();
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  const me = await requireParticipant(plan);
  if (me.role !== "organizer") throw new HttpError(403, "organizer_only");
  await db.delete(sharedPlans).where(eq(sharedPlans.id, plan.id));
  return json({ ok: true });
});
