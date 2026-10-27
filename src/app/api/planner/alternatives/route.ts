import { z } from "zod";
import { getCatalog } from "@/lib/places/catalog";
import { alternatives } from "@/lib/planner/engine";
import { SettingsSchema, StopsSchema } from "@/lib/planner/schema";
import { body, handler, HttpError, json } from "@/lib/api";

export const POST = handler(async (req: Request) => {
  const { settings, stops, index } = await body(req, z.object({ settings: SettingsSchema, stops: StopsSchema, index: z.number().int().min(0) }));
  if (index >= stops.length) throw new HttpError(400, "bad_index");
  const catalog = await getCatalog();
  return json({ places: alternatives(catalog, settings, stops, index) });
});
