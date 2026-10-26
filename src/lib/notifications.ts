import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users, type NotificationPrefs } from "@/lib/db/schema";
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
