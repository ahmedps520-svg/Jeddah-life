import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { planOptions, planVotes } from "@/lib/db/schema";
import { body, handler, HttpError, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { bump, notifyPlan, planByCode, requireParticipant } from "@/lib/together";

/** Yes (1), maybe (0) or no (-1) on a place or date; null clears the vote. */
export const PUT = handler(async (req: Request, ctx: RouteContext<"/api/together/[code]/votes">) => {
  await assertSameOrigin();
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  if (plan.status !== "planning") throw new HttpError(409, "not_planning");
  const me = await requireParticipant(plan);
  const data = await body(req, z.object({ optionId: z.string().max(64), value: z.union([z.literal(1), z.literal(0), z.literal(-1), z.null()]) }));
  if (!(await rateLimit(`plan-vote:${me.id}`, 120, 600))) throw new HttpError(429, "rate_limited");
  const [o] = await db.select({ id: planOptions.id }).from(planOptions).where(and(eq(planOptions.id, data.optionId), eq(planOptions.planId, plan.id)));
  if (!o) throw new HttpError(404, "not_found");
  if (data.value === null) {
    await db.delete(planVotes).where(and(eq(planVotes.optionId, o.id), eq(planVotes.participantId, me.id)));
  } else {
    await db
      .insert(planVotes)
      .values({ optionId: o.id, participantId: me.id, value: data.value })
      .onConflictDoUpdate({ target: [planVotes.optionId, planVotes.participantId], set: { value: data.value, updatedAt: new Date() } });
  }
  await bump(plan.id);
  // One "X voted" notice per person per hour is plenty.
  await notifyPlan(plan, me, "plan_vote", { organizerOnly: true, dedupe: `${me.id}:${Math.floor(Date.now() / 3600000)}` });
  return json({ ok: true });
});
