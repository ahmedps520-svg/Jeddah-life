import { z } from "zod";
import { getCatalog } from "@/lib/places/catalog";
import { buildPlan } from "@/lib/planner/engine";
import { SettingsSchema } from "@/lib/planner/schema";
import { withPlaces } from "@/lib/planner/respond";
import { body, handler, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { bumpPlaceStat, recordInteraction } from "@/lib/stats";

export const POST = handler(async (req: Request) => {
  const { settings, seed, mustInclude, exclude } = await body(
    req,
    z.object({ settings: SettingsSchema, seed: z.number().int().optional(), mustInclude: z.string().max(64).nullable().optional(), exclude: z.array(z.string()).max(50).optional() }),
  );
  const catalog = await getCatalog();
  const plan = buildPlan(catalog, settings, { seed: seed ?? Date.now() % 1e9, mustInclude, exclude });
  if (plan) {
    const user = await getCurrentUser();
    for (const s of plan.stops) await bumpPlaceStat(s.placeId, "plans");
    await recordInteraction(user, "plan", {});
  }
  return json({ plan, places: withPlaces(catalog, [plan]) });
});
