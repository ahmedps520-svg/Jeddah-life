import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { body, HttpError, json } from "@/lib/api";
import { adminHandler, adminMutation, readJson } from "@/lib/admin/api";
import { notifyEventSavers, validateEvent } from "@/lib/admin/events";
import { audit, changedKeys } from "@/lib/admin/audit";

async function load(id: string) {
  const [e] = await db.select().from(events).where(eq(events.id, id));
  if (!e) throw new HttpError(404, "not_found");
  return e;
}

/**
 * Update an event. When a published event's dates, venue, times or prices
 * change, the change note is recorded on the event and everyone who saved it
 * is notified (respecting their notification preferences).
 */
export const PATCH = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/events/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const existing = await load(id);
  const { values, changes, changeNote } = await validateEvent(await readJson(req), existing);
  const now = new Date();
  await db
    .update(events)
    .set({ ...values, ...(changes.length ? { changeNote, changedAt: now } : {}) })
    .where(eq(events.id, id));

  let notified = 0;
  if (changes.length && changeNote) notified = await notifyEventSavers({ ...existing, ...values }, changes, changeNote, now);

  const changed = changedKeys(existing as unknown as Record<string, unknown>, values as Record<string, unknown>).filter((k) => k !== "updatedAt");
  await audit(
    user.id,
    changes.length ? "event.update+notify" : "event.update",
    { type: "event", id },
    [changed.join(", "), changes.length ? `notified ${notified} (${changes.join(", ")}): ${changeNote}` : ""].filter(Boolean).join(" · ") || null,
  );
  return json({ ok: true, changes, notified });
});

/** Quick status change (archive / publish / draft). */
export const POST = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/events/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  await load(id);
  const { action } = await body(req, z.object({ action: z.enum(["archive", "draft"]) }));
  await db
    .update(events)
    .set({ status: action === "archive" ? "archived" : "draft", updatedAt: new Date() })
    .where(eq(events.id, id));
  await audit(user.id, `event.${action}`, { type: "event", id });
  return json({ ok: true });
});

/** Permanent deletion — only with the slug typed as confirmation. */
export const DELETE = adminHandler(async (req: Request, ctx: RouteContext<"/api/admin/events/[id]">) => {
  const user = await adminMutation();
  const { id } = await ctx.params;
  const existing = await load(id);
  const { confirm } = await body(req, z.object({ confirm: z.string().max(200) }));
  if (confirm.trim() !== existing.slug) throw new HttpError(400, "confirm_mismatch");
  await db.delete(events).where(eq(events.id, id));
  await audit(user.id, "event.delete", { type: "event", id }, `${existing.slug} — ${existing.titleEn}`);
  return json({ ok: true });
});
