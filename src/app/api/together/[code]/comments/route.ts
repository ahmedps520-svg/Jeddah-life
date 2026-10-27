import { z } from "zod";
import { db } from "@/lib/db";
import { planComments } from "@/lib/db/schema";
import { body, handler, HttpError, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/session";
import { newId } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import { bump, notifyPlan, planByCode, requireParticipant } from "@/lib/together";

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/together/[code]/comments">) => {
  await assertSameOrigin();
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  const me = await requireParticipant(plan);
  const data = await body(req, z.object({ body: z.string().trim().min(1).max(600) }));
  if (!(await rateLimit(`plan-comment:${me.id}`, 30, 600))) throw new HttpError(429, "rate_limited");
  await db.insert(planComments).values({ id: newId(), planId: plan.id, participantId: me.id, body: data.body });
  await bump(plan.id);
  await notifyPlan(plan, me, "plan_comment", { dedupe: `${me.id}:${Math.floor(Date.now() / 600000)}` });
  return json({ ok: true });
});
