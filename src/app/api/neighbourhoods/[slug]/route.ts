import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { handler, HttpError, json } from "@/lib/api";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/neighbourhoods/[slug]">) => {
  const { slug } = await ctx.params;
  const [h] = await db
    .select({ slug: neighbourhoods.slug, bbox: neighbourhoods.bbox, polygon: neighbourhoods.polygon })
    .from(neighbourhoods)
    .where(eq(neighbourhoods.slug, slug));
  if (!h) throw new HttpError(404, "not_found");
  return json(h, { headers: { "Cache-Control": "public, max-age=3600" } });
});
