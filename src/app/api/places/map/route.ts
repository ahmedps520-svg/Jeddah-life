import { getCatalog } from "@/lib/places/catalog";
import { handler, json } from "@/lib/api";
import { toMapPlace } from "@/lib/map/compact";

export const GET = handler(async () => {
  const c = await getCatalog();
  return json(
    { places: c.places.map(toMapPlace), builtAt: c.builtAt },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
});
