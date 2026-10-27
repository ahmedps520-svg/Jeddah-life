import { z } from "zod";
import { db } from "@/lib/db";
import { planParticipants, sharedPlans } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import { myPlans, newCode, planByCode } from "@/lib/together";

export const GET = handler(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ plans: [] });
  return json({ plans: await myPlans(user.id) });
});

/** Start a shared plan. Organisers need an account; anyone can join with the code. */
export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const data = await body(
    req,
    z.object({
      title: z.string().trim().min(2).max(80),
      description: z.string().trim().max(500).optional(),
      budgetPerPerson: z.number().int().min(0).max(100000).nullable().optional(),
    }),
  );
  if (!(await rateLimit(`plan-create:${user.id}`, 10, 3600))) throw new HttpError(429, "rate_limited");
  let code = newCode();
  for (let i = 0; i < 5 && (await planByCode(code)); i++) code = newCode();
  const id = newId();
  await db.insert(sharedPlans).values({
    id,
    code,
    organizerId: user.id,
    title: data.title,
    description: data.description || null,
    budgetPerPerson: data.budgetPerPerson ?? null,
  });
  await db.insert(planParticipants).values({ id: newId(), planId: id, userId: user.id, displayName: user.displayName, role: "organizer" });
  return json({ ok: true, code });
});
