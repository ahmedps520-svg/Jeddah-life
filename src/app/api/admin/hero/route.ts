import { db } from "@/lib/db";
import { heroSlides } from "@/lib/db/schema";
import { json } from "@/lib/api";
import { newId } from "@/lib/auth/password";
import { adminHandler, adminMutation, readJson } from "@/lib/admin/api";
import { validateHero } from "@/lib/admin/hero";
import { audit } from "@/lib/admin/audit";

/** Add a home page hero slide. */
export const POST = adminHandler(async (req: Request) => {
  const user = await adminMutation();
  const values = validateHero(await readJson(req));
  const id = `hero_${newId()}`;
  await db.insert(heroSlides).values({ ...values, id });
  await audit(user.id, "hero.create", { type: "hero", id }, values.titleEn);
  return json({ id });
});
