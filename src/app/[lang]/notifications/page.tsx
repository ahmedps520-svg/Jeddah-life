import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarClock, CalendarDays, Gem, MessageSquare, Route, Settings, Star, Users } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { generateDueReminders, listNotifications, markAllRead } from "@/lib/notifications";
import { cityToday, fmt, formatDay, formatTime, localized, relativeTime } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.notifications.title, robots: { index: false } };
}

type Payload = Record<string, string | number | null>;

const ICONS: Record<string, typeof Bell> = {
  event_reminder: CalendarClock,
  event_changed: CalendarDays,
  outing_reminder: Route,
  plan_joined: Users,
  plan_vote: Users,
  plan_option: Users,
  plan_invite: Users,
  plan_final: Users,
  plan_comment: MessageSquare,
  review_moderated: Star,
  submission_reviewed: Gem,
};

export default async function NotificationsPage() {
  const { t, locale } = await getDictionary();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/sign-in?next=/${locale}/notifications`);

  await generateDueReminders(user.id);
  const items = await listNotifications(user.id);
  // Opening the notification centre counts as reading it. The list above was
  // fetched first, so unread items are still highlighted on this visit.
  if (items.some((n) => !n.readAt)) await markAllRead(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] font-semibold leading-tight md:text-[44px]">{t.notifications.title}</h1>
          <p className="mt-2 max-w-xl text-ink-600">{t.notifications.lede}</p>
        </div>
        <Link href={`/${locale}/profile#notifications`} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm ring-1 ring-sand-200 hover:ring-ink-300">
          <Settings className="size-4" /> {t.notifications.settings}
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-white p-8 text-center shadow-card">
          <Bell className="mx-auto size-10 text-ink-300" />
          <p className="mt-4 font-display text-xl">{t.notifications.empty}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{t.notifications.emptyHint}</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-sand-200 overflow-hidden rounded-3xl bg-white shadow-card">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const href = targetFor(locale, n.type, n.payload);
            const text = messageFor(t, locale, n.type, n.payload);
            const body = (
              <div className={`flex gap-4 p-4 md:p-5 ${n.readAt ? "" : "bg-sea-50/60"}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sand-100 text-ink-700">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-snug text-ink-900">{text}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {relativeTime(locale, n.createdAt)}
                    {!n.readAt && (
                      <span className="ms-2 inline-flex items-center gap-1 font-semibold text-sea-700">
                        <span className="size-1.5 rounded-full bg-sea-500" aria-hidden /> {t.notifications.unreadLabel}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
            return <li key={n.id}>{href ? <Link href={href} className="block transition hover:bg-sand-50">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

function str(p: Payload, k: string): string | null {
  const v = p[k];
  return v == null || v === "" ? null : String(v);
}

function whenText(t: Dictionary, locale: Locale, isoDay: string | null, time: string | null): string {
  if (!isoDay) return "";
  const today = cityToday();
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const day =
    isoDay === today
      ? t.notifications.today
      : isoDay === tomorrow.toISOString().slice(0, 10)
        ? t.notifications.tomorrow
        : fmt(t.notifications.onDate, { date: formatDay(locale, isoDay, { weekday: "long", day: "numeric", month: "long" }) });
  return time ? `${day} ${fmt(t.notifications.atTime, { time: formatTime(locale, time) })}` : day;
}

function messageFor(t: Dictionary, locale: Locale, type: string, p: Payload): string {
  const m = t.notifications.messages as Record<string, string>;
  const template = m[type];
  if (!template) return t.notifications.title;
  const title =
    localized(locale, str(p, "titleEn") ?? str(p, "title"), str(p, "titleAr")) ??
    localized(locale, str(p, "placeNameEn"), str(p, "placeNameAr")) ??
    str(p, "name") ??
    "";
  const rawStatus = str(p, "status") ?? str(p, "action") ?? "";
  const status = (t.notifications.statuses as Record<string, string>)[rawStatus] ?? rawStatus;
  const when =
    type === "event_reminder"
      ? whenText(t, locale, str(p, "startDate"), null)
      : type === "outing_reminder"
        ? whenText(t, locale, str(p, "date"), str(p, "startTime"))
        : "";
  // User- and admin-entered text may be in either language; isolate it so it
  // doesn't scramble the surrounding sentence's direction.
  const iso = (s: string) => (s ? `\u2068${s}\u2069` : s);
  return fmt(template, {
    title: iso(title),
    when,
    status,
    note: iso(str(p, "note") ?? ""),
    actor: iso(str(p, "actor") ?? t.notifications.someone),
  });
}

function targetFor(locale: Locale, type: string, p: Payload): string | null {
  const base = `/${locale}`;
  if (type.startsWith("event_") && str(p, "slug")) return `${base}/events/${str(p, "slug")}`;
  if (type === "outing_reminder" && str(p, "itineraryId")) return `${base}/plan/${str(p, "itineraryId")}`;
  if (type.startsWith("plan_") && str(p, "code")) return `${base}/together/${str(p, "code")}`;
  if (type === "review_moderated" && str(p, "placeSlug")) return `${base}/place/${str(p, "placeSlug")}`;
  if (type === "submission_reviewed") return str(p, "submissionId") ? `${base}/hidden-gems/${str(p, "submissionId")}` : `${base}/profile#submissions`;
  return null;
}
