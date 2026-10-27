import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { body, HttpError, json } from "@/lib/api";
import { adminHandler, adminMutation } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";

/** Promote to or demote from administrator. An admin can never demote themselves. */
export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const { role } = await body(req, z.object({ role: z.enum(["user", "admin"]) }));
  if (id === user.id && role !== "admin") throw new HttpError(400, "self_demote");
  const [target] = await db.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq(users.id, id));
  if (!target) throw new HttpError(404, "not_found");
  if (target.role !== role) {
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
    await audit(user.id, role === "admin" ? "user.promote" : "user.demote", { type: "user", id }, target.email);
  }
  return json({ ok: true });
});
