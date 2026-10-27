import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { planParticipants } from "@/lib/db/schema";
import { body, handler, HttpError, json } from "@/lib/api";
import { assertSameOrigin, getCurrentUser } from "@/lib/auth/session";
import { newId, sha256 } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import { bump, clearGuestCookie, currentParticipant, notifyPlan, planByCode, setGuestCookie } from "@/lib/together";

const MAX_PARTICIPANTS = 30;

/** Join with an account, or as a guest with just a name. */
export const POST = handler(async (req: Request, ctx: RouteContext<"/api/together/[code]/join">) => {
  await assertSameOrigin();
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  if (plan.status === "cancelled") throw new HttpError(409, "cancelled");
  const user = await getCurrentUser();
  if (await currentParticipant(plan, user)) return json({ ok: true });

  const data = await body(req, z.object({ displayName: z.string().trim().min(1).max(40).optional() }));
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!(await rateLimit(`plan-join:${user ? user.id : sha256(ip).slice(0, 16)}`, 20, 3600))) throw new HttpError(429, "rate_limited");
  const count = (await db.select({ id: planParticipants.id }).from(planParticipants).where(eq(planParticipants.planId, plan.id))).length;
  if (count >= MAX_PARTICIPANTS) throw new HttpError(409, "full");

  const id = newId();
  if (user) {
    await db.insert(planParticipants).values({ id, planId: plan.id, userId: user.id, displayName: data.displayName || user.displayName });
  } else {
    if (!data.displayName) throw new HttpError(400, "name_required");
    const hash = await setGuestCookie(plan.code);
    await db.insert(planParticipants).values({ id, planId: plan.id, displayName: data.displayName, guestTokenHash: hash });
  }
  await bump(plan.id);
  const [me] = await db.select().from(planParticipants).where(eq(planParticipants.id, id));
  await notifyPlan(plan, me, "plan_joined", { organizerOnly: true, dedupe: id });
  return json({ ok: true });
});

/** Leave a plan. The organiser can't leave; they can cancel or delete it instead. */
export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/together/[code]/join">) => {
  await assertSameOrigin();
  const { code } = await ctx.params;
  const plan = await planByCode(code);
  if (!plan) throw new HttpError(404, "not_found");
  const me = await currentParticipant(plan);
  if (!me) return json({ ok: true });
  if (me.role === "organizer") throw new HttpError(409, "organizer_cannot_leave");
  await db.delete(planParticipants).where(eq(planParticipants.id, me.id));
  if (!me.userId) await clearGuestCookie(plan.code);
  await bump(plan.id);
  return json({ ok: true });
});
