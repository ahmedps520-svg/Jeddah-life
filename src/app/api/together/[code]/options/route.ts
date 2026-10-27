import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { planOptions } from "@/lib/db/schema";
import { body, handler, HttpError, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/session";
import { newId } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import { getCatalog } from "@/lib/places/catalog";
import { cityToday } from "@/lib/i18n/format";
import { bump, notifyPlan, planByCode, requireParticipant } from "@/lib/together";

const MAX_OPTIONS = 40;

const B = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("place"), placeId: z.string().min(1).max(64), note: z.string().trim().max(200).optional() }),
  z.object({
    kind: z.literal("date"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d)?$/),
    note: z.string().trim().max(200).optional(),
  }),
]);

/** Any participant can suggest a place or a date while the plan is open. */
export const POST = handler(async (req: Request, ctx: RouteContext<"/api/together/[code]/options">) => {
  await assertSameOrigin();
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  if (plan.status !== "planning") throw new HttpError(409, "not_planning");
  const me = await requireParticipant(plan);
  const data = await body(req, B);
  if (!(await rateLimit(`plan-option:${me.id}`, 30, 3600))) throw new HttpError(429, "rate_limited");

  const existing = await db.select().from(planOptions).where(eq(planOptions.planId, plan.id));
  if (existing.length >= MAX_OPTIONS) throw new HttpError(409, "too_many_options");
  if (data.kind === "place") {
    if (!(await getCatalog()).byId.has(data.placeId)) throw new HttpError(400, "unknown_place");
    if (existing.some((o) => o.kind === "place" && o.placeId === data.placeId)) throw new HttpError(409, "duplicate");
  } else {
    if (data.date.slice(0, 10) < cityToday()) throw new HttpError(400, "past_date");
    if (existing.some((o) => o.kind === "date" && o.dateValue === data.date)) throw new HttpError(409, "duplicate");
  }
  await db.insert(planOptions).values({
    id: newId(),
    planId: plan.id,
    kind: data.kind,
    placeId: data.kind === "place" ? data.placeId : null,
    dateValue: data.kind === "date" ? data.date : null,
    note: data.note || null,
    proposedBy: me.id,
  });
  await bump(plan.id);
  await notifyPlan(plan, me, "plan_option", { dedupe: `${me.id}:${Math.floor(Date.now() / 600000)}` });
  return json({ ok: true });
});

