import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { Archive, BellRing, ExternalLink, EyeOff } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { events, eventSaves, places } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { getCurrentUser } from "@/lib/auth/session";
import { eventToForm } from "@/lib/admin/events";
import type { PlaceHit } from "@/lib/admin/types";
import { formatDateTime, localized, plural } from "@/lib/i18n/format";
import { Badge, PageHeader, STATUS_TONE, cardClass } from "@/components/admin/ui";
import { EventForm } from "@/components/admin/event-form";
import { ActionButton } from "@/components/admin/form";
import { DeleteRecord } from "@/components/admin/place-actions";

async function load(id: string) {
  const [e] = await db.select().from(events).where(eq(events.id, id));
  return e ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/events/[id]">): Promise<Metadata> {
  const { t, locale } = await getDictionary();
  if ((await getCurrentUser())?.role !== "admin") return { title: t.admin.title };
  const e = await load((await params).id);
  return { title: e ? (localized(locale, e.titleEn, e.titleAr) ?? e.titleEn) : t.admin.events.editTitle };
}

export default async function EditEvent({ params }: PageProps<"/[lang]/admin/events/[id]">) {
  const { id } = await params;
  if (!(await requireAdminPage(`/events/${id}`))) return null;
  const { t, locale } = await getDictionary();
  const a = t.admin.events;
  const e = await load(id);
  if (!e) notFound();

  const [[{ n: saves }], linked] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(eventSaves).where(eq(eventSaves.eventId, id)),
    e.placeId
      ? db
          .select({
            id: places.id,
            slug: places.slug,
            nameEn: places.nameEn,
            nameAr: places.nameAr,
            category: places.category,
            status: places.status,
            lat: places.lat,
            lng: places.lng,
            neighbourhood: places.neighbourhood,
          })
          .from(places)
          .where(eq(places.id, e.placeId))
          .then((r) => (r[0] as PlaceHit | undefined) ?? null)
      : Promise.resolve(null),
  ]);
  const savers = Number(saves);
  const url = `/api/admin/events/${id}`;

  return (
    <div>
      <PageHeader
        title={localized(locale, e.titleEn, e.titleAr) ?? e.titleEn}
        back={{ href: `/${locale}/admin/events`, label: a.title }}
        lede={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[e.status]}>{t.admin.status[e.status]}</Badge>
            <span className="text-sm text-ink-500">{plural(locale, savers, a.savesCount)}</span>
          </span>
        }
        actions={
          e.status === "published" ? (
            <Link
              href={`/${locale}/events/${e.slug}`}
              target="_blank"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium ring-1 ring-sand-300 hover:ring-ink-300"
            >
              <ExternalLink className="size-4" aria-hidden /> {t.admin.common.viewOnSite}
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="order-2 min-w-0 xl:order-1">
          <EventForm eventId={e.id} initial={eventToForm(e)} linkedPlace={linked} saves={savers} />
        </div>
        <aside className="order-1 xl:order-2">
          <div className={`${cardClass} space-y-4 xl:sticky xl:top-[calc(var(--header-h)+24px)]`}>
            {e.changedAt && e.changeNote && (
              <p className="flex items-start gap-2 rounded-xl bg-gold-400/15 p-3 text-xs text-ink-700">
                <BellRing className="mt-0.5 size-3.5 shrink-0 text-gold-500" aria-hidden />
                {a.lastChange.replace("{date}", formatDateTime(locale, e.changedAt)).replace("{note}", e.changeNote)}
              </p>
            )}
            <dl className="divide-y divide-sand-100 text-sm">
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-ink-500">{t.admin.places.slug}</dt>
                <dd className="font-medium [overflow-wrap:anywhere]" dir="ltr">
                  {e.slug}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-ink-500">{t.admin.places.createdAt}</dt>
                <dd className="font-medium">{formatDateTime(locale, e.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-ink-500">{t.admin.places.updatedAt}</dt>
                <dd className="font-medium">{formatDateTime(locale, e.updatedAt, { timeStyle: "short" })}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              {e.status === "published" && (
                <ActionButton url={url} payload={{ action: "draft" }} label={t.admin.places.unpublish} done={t.admin.common.saved} icon={<EyeOff className="size-4" aria-hidden />} />
              )}
              {e.status !== "archived" && (
                <ActionButton
                  url={url}
                  payload={{ action: "archive" }}
                  label={a.archive}
                  done={a.archived}
                  icon={<Archive className="size-4" aria-hidden />}
                  confirm={{ title: a.archive, body: a.archiveConfirm }}
                />
              )}
              <DeleteRecord url={url} slug={e.slug} after={`/${locale}/admin/events`} labels={{ title: a.dangerZone, lede: a.deleteLede, button: a.delete, done: a.deleted }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
