import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { json } from "@/lib/api";
import { newId } from "@/lib/auth/password";
import { adminHandler, adminMutation, readJson } from "@/lib/admin/api";
import { validateEvent } from "@/lib/admin/events";
import { uniqueSlug } from "@/lib/admin/places";
import { audit } from "@/lib/admin/audit";

/** Create an event (always origin "admin": entered by an administrator from a cited source). */
export const POST = adminHandler(async (req: Request) => {
  const user = await adminMutation();
  const { values } = await validateEvent(await readJson(req), null);
  const id = `ev_${newId()}`;
  const slug = await uniqueSlug("events", `${values.titleEn} ${values.startDate.slice(0, 4)}`, "event");
  await db.insert(events).values({ ...values, id, slug, origin: "admin" });
  await audit(user.id, "event.create", { type: "event", id }, `${values.titleEn} (${values.status})`);
  return json({ id, slug });
});
