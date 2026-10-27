import { getCatalog } from "@/lib/places/catalog";
import { searchPlaces } from "@/lib/search/engine";
import { handler, json } from "@/lib/api";

/** Lightweight place search used by pickers (add a stop, propose a place). */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const limit = Math.min(20, Number(url.searchParams.get("limit")) || 10);
  const c = await getCatalog();
  const r = await searchPlaces(c, { q, limit });
  return json({ hits: r.hits });
});
