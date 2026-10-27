import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planOptions } from "@/lib/db/schema";
import { handler, HttpError, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/session";
import { bump, planByCode, requireParticipant } from "@/lib/together";

/** The person who suggested an option, or the organiser, can withdraw it. */
export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/together/[code]/options/[optionId]">) => {
  await assertSameOrigin();
  const { code, optionId } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  if (plan.status !== "planning") throw new HttpError(409, "not_planning");
  const me = await requireParticipant(plan);
  const [o] = await db.select().from(planOptions).where(and(eq(planOptions.id, optionId), eq(planOptions.planId, plan.id)));
  if (!o) throw new HttpError(404, "not_found");
  if (o.proposedBy !== me.id && me.role !== "organizer") throw new HttpError(403, "forbidden");
  await db.delete(planOptions).where(eq(planOptions.id, o.id));
  await bump(plan.id);
  return json({ ok: true });
});
