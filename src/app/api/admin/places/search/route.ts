import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { searchPlaces } from "@/lib/admin/places";

/** Admin place lookup for linking events, submissions and picks (includes drafts unless ?published=1). */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").slice(0, 100);
  const hits = await searchPlaces(q, { publishedOnly: sp.get("published") === "1" });
  return json({ places: hits }, { headers: { "Cache-Control": "no-store" } });
});
