import { getCatalog } from "@/lib/places/catalog";
import { handler, json } from "@/lib/api";

export const GET = handler(async () => {
  const c = await getCatalog();
  return json({ hoods: c.hoods }, { headers: { "Cache-Control": "public, max-age=300" } });
});
