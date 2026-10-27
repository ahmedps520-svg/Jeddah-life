import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { json } from "@/lib/api";
import { newId } from "@/lib/auth/password";
import { invalidateCatalog } from "@/lib/places/catalog";
import { adminHandler, adminMutation, readJson } from "@/lib/admin/api";
import { uniqueSlug, validatePlace } from "@/lib/admin/places";
import { audit } from "@/lib/admin/audit";

/** Create a place. */
export const POST = adminHandler(async (req: Request) => {
  const user = await adminMutation();
  const { values } = await validatePlace(await readJson(req), null);
  const id = `ad_${newId()}`;
  const slug = await uniqueSlug("places", values.nameEn ?? "", "place");
  await db.insert(places).values({
    ...values,
    id,
    slug,
    source: "admin",
    sourceRef: null,
    verification: values.verification ?? "unverified",
  });
  invalidateCatalog();
  await audit(user.id, "place.create", { type: "place", id }, `${values.nameEn ?? values.nameAr} (${values.status})`);
  return json({ id, slug });
});
