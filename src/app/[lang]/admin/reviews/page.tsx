import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { Eye, EyeOff, Flag, Trash2 } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { places, reports, reviews, users } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatDateTime, formatDay, formatNumber, formatSar, placeName, plural } from "@/lib/i18n/format";
import { Stars } from "@/components/place/review-section";
import { Badge, EmptyState, LinkTabs, PageHeader, Pagination, STATUS_TONE, flatParams, hrefWith } from "@/components/admin/ui";
import { NoteAction } from "@/components/admin/moderation-actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.reviews.title };
}

const PAGE_SIZE = 20;
type Tab = "reported" | "recent" | "moderated";

export default async function AdminReviews({ searchParams }: PageProps<"/[lang]/admin/reviews">) {
  const raw = await searchParams;
  if (!(await requireAdminPage("/reviews", raw))) return null;
  const { t, locale } = await getDictionary();
  const r = t.admin.reviews;
  const sp = flatParams(raw);
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));

  const openReviewReports = db
    .select({ id: reports.targetId })
    .from(reports)
    .where(and(eq(reports.targetType, "review"), eq(reports.status, "open")));
  const [[{ n: reportedN }]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(reviews).where(inArray(reviews.id, openReviewReports)),
  ]);
  const tab: Tab = sp.tab === "recent" || sp.tab === "moderated" || sp.tab === "reported" ? sp.tab : Number(reportedN) ? "reported" : "recent";

  const where =
    tab === "reported" ? inArray(reviews.id, openReviewReports) : tab === "moderated" ? ne(reviews.status, "published") : undefined;

  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(reviews).where(where),
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        status: reviews.status,
        moderatorNote: reviews.moderatorNote,
        visitDate: reviews.visitDate,
        spentPerPerson: reviews.spentPerPerson,
        photos: reviews.photos,
        createdAt: reviews.createdAt,
        placeId: places.id,
        slug: places.slug,
        nameEn: places.nameEn,
        nameAr: places.nameAr,
        author: users.displayName,
        email: users.email,
      })
      .from(reviews)
      .innerJoin(places, eq(places.id, reviews.placeId))
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const reportRows = rows.length
    ? await db
        .select({ targetId: reports.targetId, reason: reports.reason, details: reports.details })
        .from(reports)
        .where(and(eq(reports.targetType, "review"), eq(reports.status, "open"), inArray(reports.targetId, rows.map((x) => x.id))))
    : [];
  const reportsBy = new Map<string, { reason: string; details: string | null }[]>();
  for (const rep of reportRows) reportsBy.set(rep.targetId, [...(reportsBy.get(rep.targetId) ?? []), rep]);

  const count = Number(total);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const base = `/${locale}/admin/reviews`;
  const reasons = t.report.reasons as Record<string, string>;
  const url = (id: string) => `/api/admin/reviews/${id}`;

  return (
    <div>
      <PageHeader title={r.title} lede={r.lede} />
      <LinkTabs
        label={r.title}
        tabs={[
          { href: `${base}?tab=reported`, label: r.tabReported, active: tab === "reported", count: Number(reportedN) ? formatNumber(locale, Number(reportedN)) : undefined },
          { href: `${base}?tab=recent`, label: r.tabRecent, active: tab === "recent" },
          { href: `${base}?tab=moderated`, label: r.tabModerated, active: tab === "moderated" },
        ]}
      />

      {rows.length ? (
        <ul className="space-y-4">
          {rows.map((x) => {
            const reps = reportsBy.get(x.id) ?? [];
            return (
              <li key={x.id} id={`review-${x.id}`} className="rounded-3xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/${locale}/admin/places/${x.placeId}`} className="font-semibold hover:text-sea-600 hover:underline">
                      {placeName(locale, x) || x.slug}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <Stars value={x.rating} size="size-3.5" />
                      <span className="sr-only">{formatNumber(locale, x.rating)}/5</span>
                      <span>{t.admin.common.by.replace("{name}", x.author)}</span>
                      <span dir="ltr">{x.email}</span>
                      <span>· {formatDateTime(locale, x.createdAt)}</span>
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {reps.length > 0 && (
                      <Badge tone="coral">
                        <Flag className="size-3" aria-hidden /> {plural(locale, reps.length, r.reports)}
                      </Badge>
                    )}
                    <Badge tone={STATUS_TONE[x.status]}>{t.admin.status[x.status]}</Badge>
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-[15px] text-ink-800">{x.body}</p>
                {(x.visitDate || x.spentPerPerson != null) && (
                  <p className="mt-2 text-xs text-ink-500">
                    {x.visitDate && r.visited.replace("{date}", formatDay(locale, x.visitDate, { year: "numeric" }))}
                    {x.visitDate && x.spentPerPerson != null && " · "}
                    {x.spentPerPerson != null && r.spent.replace("{amount}", formatSar(locale, x.spentPerPerson))}
                  </p>
                )}
                {x.photos.length > 0 && (
                  <ul className="mt-3 flex gap-2">
                    {x.photos.map((ph) => (
                      <li key={ph.url}>
                        <a href={ph.url} target="_blank" rel="noreferrer" className="block size-20 overflow-hidden rounded-xl bg-sand-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.url} alt="" className="size-full object-cover" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {reps.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-2xl bg-coral-400/10 p-3 text-sm">
                    {reps.map((rep, i) => (
                      <li key={i}>
                        <span className="font-medium">{reasons[rep.reason] ?? rep.reason}</span>
                        {rep.details && <span className="text-ink-600"> — {rep.details}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {x.moderatorNote && (
                  <p className="mt-3 rounded-2xl bg-sand-100 p-3 text-sm text-ink-700">
                    <span className="font-medium">{r.moderatorNote}:</span> {x.moderatorNote}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-sand-100 pt-4">
                  {x.status === "published" && (
                    <NoteAction
                      url={url(x.id)}
                      payload={{ action: "hide" }}
                      label={r.hide}
                      title={r.hideTitle}
                      body={r.hideLede}
                      noteLabel={r.moderatorNote}
                      noteHint={t.admin.common.noteHint}
                      done={r.done}
                      icon={<EyeOff className="size-4" aria-hidden />}
                    />
                  )}
                  {x.status !== "published" && (
                    <NoteAction
                      url={url(x.id)}
                      payload={{ action: "unhide" }}
                      label={r.unhide}
                      title={r.unhideTitle}
                      body={r.unhideLede}
                      noteLabel={r.moderatorNote}
                      noteHint={t.admin.common.noteHint}
                      noteRequired={false}
                      done={r.done}
                      icon={<Eye className="size-4" aria-hidden />}
                    />
                  )}
                  {x.status !== "removed" && (
                    <NoteAction
                      url={url(x.id)}
                      payload={{ action: "remove" }}
                      label={r.remove}
                      title={r.removeTitle}
                      body={r.removeLede}
                      noteLabel={r.moderatorNote}
                      noteHint={t.admin.common.noteHint}
                      done={r.done}
                      variant="ghost"
                      tone="danger"
                      icon={<Trash2 className="size-4" aria-hidden />}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>{tab === "reported" ? r.emptyReported : tab === "moderated" ? r.emptyModerated : r.emptyRecent}</EmptyState>
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(n) => hrefWith(base, { tab }, { page: n })}
        labels={{
          previous: t.admin.common.previous,
          next: t.admin.common.next,
          pageOf: t.admin.common.pageOf.replace("{n}", formatNumber(locale, page)).replace("{total}", formatNumber(locale, pages)),
        }}
      />
    </div>
  );
}
