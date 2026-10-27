import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places, type Place } from "@/lib/db/schema";
import { body, HttpError, json } from "@/lib/api";
import { invalidateCatalog } from "@/lib/places/catalog";
import { adminHandler, adminMutation } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";

const Action = z.object({
  action: z.enum(["verify", "publish", "draft", "archive", "flag", "unflag", "pick", "unpick"]),
});

/** Quick actions used from the list, the edit page sidebar, reports and featured content. */
export const POST = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/places/[id]/action">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const { action } = await body(req, Action);
  const [p] = await db.select({ id: places.id, status: places.status }).from(places).where(eq(places.id, id));
  if (!p) throw new HttpError(404, "not_found");

  const now = new Date();
  const set: Partial<Place> = { updatedAt: now };
  switch (action) {
    case "verify":
      Object.assign(set, { verification: "verified", lastVerifiedAt: now, flaggedOutdated: false });
      break;
    case "publish":
    case "draft":
    case "archive":
      set.status = action === "publish" ? "published" : action === "draft" ? "draft" : "archived";
      break;
    case "flag":
    case "unflag":
      set.flaggedOutdated = action === "flag";
      break;
    case "pick":
    case "unpick":
      if (action === "pick" && p.status !== "published") throw new HttpError(400, "not_published");
      set.editorsPick = action === "pick";
      break;
  }
  await db.update(places).set(set).where(eq(places.id, id));
  invalidateCatalog();
  await audit(user.id, `place.${action}`, { type: "place", id });
  return json({ ok: true });
});
