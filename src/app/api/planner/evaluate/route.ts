import { z } from "zod";
import { getCatalog } from "@/lib/places/catalog";
import { evaluate } from "@/lib/planner/engine";
import { SettingsSchema, StopsSchema } from "@/lib/planner/schema";
import { withPlaces } from "@/lib/planner/respond";
import { body, handler, json } from "@/lib/api";

/** Recalculate times, travel and costs after the user edits an outing. */
export const POST = handler(async (req: Request) => {
  const { settings, stops } = await body(req, z.object({ settings: SettingsSchema, stops: StopsSchema }));
  const catalog = await getCatalog();
  const plan = evaluate(catalog, settings, stops);
  return json({ plan, places: withPlaces(catalog, [plan]) });
});
