import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { body, handler, json, mutationUser } from "@/lib/api";
import { randomToken } from "@/lib/auth/password";
import { ownCollection } from "@/lib/collections";

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(280).nullable().optional(),
  isPublic: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/me/collections/[id]">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  const c = await ownCollection(user.id, id);
  const data = await body(req, Patch);
  await db
    .update(collections)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.isPublic !== undefined
        ? { isPublic: data.isPublic, shareToken: data.isPublic ? (c.shareToken ?? randomToken(12)) : c.shareToken }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(collections.id, id));
  return json({ ok: true });
});

export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/me/collections/[id]">) => {
  const user = await mutationUser();
  const { id } = await ctx.params;
  await ownCollection(user.id, id);
  await db.delete(collections).where(eq(collections.id, id));
  return json({ ok: true });
});
