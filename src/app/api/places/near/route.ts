import { z } from "zod";
import { getCatalog } from "@/lib/places/catalog";
import { haversineKm } from "@/lib/places/estimates";
import { handler, json } from "@/lib/api";

const Q = z.object({
  lat: z.coerce.number().min(21).max(22.3),
  lng: z.coerce.number().min(38.8).max(39.6),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

/** Places within 4 km of a point, favouring well-documented and popular ones. */
export const GET = handler(async (req: Request) => {
  const { lat, lng, limit } = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const c = await getCatalog();
  const origin = { lat, lng };
  const brands = new Set<string>();
  const hits = c.places
    .map((p) => ({ ...p, distanceKm: haversineKm(origin, p) }))
    .filter((p) => p.distanceKm <= 4)
    .map((p) => ({
      p,
      score:
        (p.ver === "verified" ? 6 : 0) + (p.img ? 5 : 0) + (p.chain ? -5 : 0) + Math.log2(1 + p.pop + p.saves * 2) * 2 - p.distanceKm * 2.5,
    }))
    .sort((a, b) => b.score - a.score)
    .filter(({ p }) => {
      if (!p.brand) return true;
      if (brands.has(p.brand)) return false;
      brands.add(p.brand);
      return true;
    })
    .slice(0, limit)
    .map(({ p }) => p);
  return json({ hits });
});
