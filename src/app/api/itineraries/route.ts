import { z } from "zod";
import { db } from "@/lib/db";
import { itineraries } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { newId } from "@/lib/auth/password";
import { getCatalog } from "@/lib/places/catalog";
import { evaluate } from "@/lib/planner/engine";
import { SettingsSchema, StopsSchema } from "@/lib/planner/schema";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const { title, settings, stops } = await body(req, z.object({ title: z.string().trim().min(1).max(80), settings: SettingsSchema, stops: StopsSchema.min(1) }));
  if (!(await rateLimit(`itin:${user.id}`, 60, 3600))) throw new HttpError(429, "rate_limited");
  const plan = evaluate(await getCatalog(), settings, stops);
  const id = newId();
  await db.insert(itineraries).values({
    id,
    userId: user.id,
    title,
    date: settings.date,
    startTime: settings.startTime,
    durationMin: settings.durationMin,
    groupType: settings.groupType,
    groupSize: settings.groupSize,
    budget: settings.budget == null ? null : Math.round(settings.budget),
    budgetMode: settings.budgetMode,
    interests: settings.interests,
    transport: settings.transport,
    startLabel: settings.start?.label ?? null,
    startLat: settings.start?.lat ?? null,
    startLng: settings.start?.lng ?? null,
    stops: plan.stops.map((s, i) => ({
      id: `${i}`,
      placeId: s.placeId,
      durationMin: s.durationMin,
      costPerPerson: s.cost.perPerson,
      costBasis: s.cost.basis,
      note: s.kind,
    })),
  });
  return json({ id });
});
