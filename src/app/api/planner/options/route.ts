import { z } from "zod";
import { getCatalog } from "@/lib/places/catalog";
import { makeItHappen, surprise } from "@/lib/planner/options";
import { SettingsSchema } from "@/lib/planner/schema";
import { withPlaces } from "@/lib/planner/respond";
import { body, handler, json } from "@/lib/api";

export const POST = handler(async (req: Request) => {
  const { settings, seed, mode } = await body(
    req,
    z.object({ settings: SettingsSchema, seed: z.number().int().optional(), mode: z.enum(["options", "surprise"]).default("options") }),
  );
  const catalog = await getCatalog();
  const s = seed ?? Date.now() % 1e9;
  const options = mode === "surprise" ? [surprise(catalog, settings, s)] : makeItHappen(catalog, settings, s);
  return json({ options, places: withPlaces(catalog, options.map((o) => o.plan)) });
});
