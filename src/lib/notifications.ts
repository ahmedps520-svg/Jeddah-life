import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventSaves, events, itineraries, notifications, users, type NotificationPrefs } from "@/lib/db/schema";
import { cityToday } from "@/lib/i18n/format";
import { newId } from "@/lib/auth/password";

/**
 * In-app notifications. Every notification is created by a real event
 * (an invitation, a vote, a saved event changing, a reminder for something
 * the user scheduled) and respects the user's preferences. Nothing is
 * generated just to make the app look busy, and promotional messages are
 * only possible when the user has opted in.
 */

export type NotificationType =
  | "plan_joined"
  | "plan_vote"
  | "plan_comment"
  | "plan_option"
  | "plan_invite"
  | "plan_final"
  | "event_reminder"
  | "event_changed"
  | "outing_reminder"
  | "review_moderated"
  | "submission_reviewed";

const PREF_FOR: Record<NotificationType, keyof NotificationPrefs | null> = {
  plan_joined: "planActivity",
  plan_vote: "planActivity",
  plan_comment: "planActivity",
  plan_option: "planActivity",
  plan_invite: "planInvites",
  plan_final: "planActivity",
  event_reminder: "savedEvents",
  event_changed: "eventChanges",
  outing_reminder: "outingReminders",
  review_moderated: null,
  submission_reviewed: null,
};

export async function notify(
  userId: string,
  type: NotificationType,
  payload: Record<string, string | number | null>,
  dedupeKey?: string,
) {
  const pref = PREF_FOR[type];
  if (pref) {
    const [u] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, userId));
    if (!u || u.prefs?.[pref] === false) return;
  }
  await db
    .insert(notifications)
    .values({ id: newId(), userId, type, payload, dedupeKey: dedupeKey ?? null })
    .onConflictDoNothing();
}

export async function unreadCount(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function listNotifications(userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Creates reminders that have become due for this user: saved events that
 * start today or tomorrow, saved events whose details were changed by the
 * organiser since the user last heard about it, and planned outings dated
 * today or tomorrow. Runs lazily when the user loads a page, so no background
 * worker is needed; dedupe keys and the reminded/notified columns make it
 * idempotent.
 */
export async function generateDueReminders(userId: string): Promise<void> {
  const today = cityToday();
  const tomorrow = addDays(today, 1);
  try {
    const saved = await db
      .select({
        eventId: events.id,
        slug: events.slug,
        titleEn: events.titleEn,
        titleAr: events.titleAr,
        startDate: events.startDate,
        endDate: events.endDate,
        changeNote: events.changeNote,
        changedAt: events.changedAt,
        remindedAt: eventSaves.remindedAt,
        notifiedChangeAt: eventSaves.notifiedChangeAt,
        savedAt: eventSaves.createdAt,
      })
      .from(eventSaves)
      .innerJoin(events, eq(events.id, eventSaves.eventId))
      .where(and(eq(eventSaves.userId, userId), eq(events.status, "published"), gte(events.endDate, today)));

    for (const e of saved) {
      const base = { eventId: e.eventId, slug: e.slug, titleEn: e.titleEn, titleAr: e.titleAr };
      if (!e.remindedAt && (e.startDate === today || e.startDate === tomorrow)) {
        await notify(userId, "event_reminder", { ...base, startDate: e.startDate }, `event_reminder:${userId}:${e.eventId}`);
        await db
          .update(eventSaves)
          .set({ remindedAt: new Date() })
          .where(and(eq(eventSaves.userId, userId), eq(eventSaves.eventId, e.eventId)));
      }
      const seen = e.notifiedChangeAt ?? e.savedAt;
      if (e.changedAt && e.changeNote && e.changedAt > seen) {
        await notify(
          userId,
          "event_changed",
          { ...base, note: e.changeNote },
          `event_changed:${userId}:${e.eventId}:${e.changedAt.getTime()}`,
        );
        await db
          .update(eventSaves)
          .set({ notifiedChangeAt: e.changedAt })
          .where(and(eq(eventSaves.userId, userId), eq(eventSaves.eventId, e.eventId)));
      }
    }

    const outings = await db
      .select({ id: itineraries.id, title: itineraries.title, date: itineraries.date, startTime: itineraries.startTime })
      .from(itineraries)
      .where(
        and(
          eq(itineraries.userId, userId),
          isNull(itineraries.remindedAt),
          inArray(itineraries.date, [today, tomorrow]),
        ),
      );
    for (const o of outings) {
      await notify(
        userId,
        "outing_reminder",
        { itineraryId: o.id, title: o.title, date: o.date, startTime: o.startTime },
        `outing_reminder:${o.id}:${o.date}`,
      );
      await db.update(itineraries).set({ remindedAt: new Date() }).where(eq(itineraries.id, o.id));
    }
  } catch (err) {
    // Reminders must never break page rendering.
    console.error("[notifications] reminder generation failed", err);
  }
}

export async function markRead(userId: string, id: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.id, id), isNull(notifications.readAt)));
}
