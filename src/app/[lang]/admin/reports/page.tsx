import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { AlertTriangle, CheckCircle2, ExternalLink, RotateCcw, XCircle } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { events, places, reports, reviews, submissions, users } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatDateTime, formatNumber, localized, placeName } from "@/lib/i18n/format";
import { Badge, EmptyState, LinkTabs, PageHeader, Pagination, STATUS_TONE, flatParams, hrefWith } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/form";
import { NoteAction } from "@/components/admin/moderation-actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.reports.title };
}

const PAGE_SIZE = 25;
type Tab = "open" | "resolved" | "dismissed";

export default async function AdminReports({ searchParams }: PageProps<"/[lang]/admin/reports">) {
  const raw = await searchParams;
  if (!(await requireAdminPage("/reports", raw))) return null;
  const { t, locale } = await getDictionary();
  const r = t.admin.reports;
  const sp = flatParams(raw);
  const tab: Tab = sp.tab === "resolved" || sp.tab === "dismissed" ? sp.tab : "open";
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));

  const reporter = alias(users, "reporter");
  const resolver = alias(users, "resolver");
  const [counts, rows] = await Promise.all([
    db.select({ status: reports.status, n: sql<number>`count(*)` }).from(reports).groupBy(reports.status),
    db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        resolution: reports.resolution,
        resolvedAt: reports.resolvedAt,
        createdAt: reports.createdAt,
        reporterName: reporter.displayName,
        resolverName: resolver.displayName,
      })
      .from(reports)
      .leftJoin(reporter, eq(reporter.id, reports.userId))
      .leftJoin(resolver, eq(resolver.id, reports.resolvedBy))
      .where(eq(reports.status, tab))
      .orderBy(tab === "open" ? desc(reports.createdAt) : desc(reports.resolvedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  // Look up every target in one query per type.
  const ids = (type: string) => rows.filter((x) => x.targetType === type).map((x) => x.targetId);
  const [placeRows, reviewRows, subRows, eventRows] = await Promise.all([
    ids("place").length
      ? db
          .select({ id: places.id, slug: places.slug, nameEn: places.nameEn, nameAr: places.nameAr, flagged: places.flaggedOutdated, status: places.status })
          .from(places)
          .where(inArray(places.id, ids("place")))
      : [],
    ids("review").length
      ? db
          .select({ id: reviews.id, body: reviews.body, status: reviews.status, nameEn: places.nameEn, nameAr: places.nameAr })
          .from(reviews)
          .innerJoin(places, eq(places.id, reviews.placeId))
          .where(inArray(reviews.id, ids("review")))
      : [],
    ids("submission").length ? db.select({ id: submissions.id, name: submissions.name }).from(submissions).where(inArray(submissions.id, ids("submission"))) : [],
    ids("event").length
      ? db.select({ id: events.id, titleEn: events.titleEn, titleAr: events.titleAr }).from(events).where(inArray(events.id, ids("event")))
      : [],
  ]);
  const placeBy = new Map(placeRows.map((x) => [x.id, x]));
  const reviewBy = new Map(reviewRows.map((x) => [x.id, x]));
  const subBy = new Map(subRows.map((x) => [x.id, x]));
  const eventBy = new Map(eventRows.map((x) => [x.id, x]));

  const countBy = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Record<string, number>;
  const pages = Math.max(1, Math.ceil((countBy[tab] ?? 0) / PAGE_SIZE));
  const base = `/${locale}/admin/reports`;
  const admin = `/${locale}/admin`;
  const reasons = t.report.reasons as Record<string, string>;
  const url = (id: string) => `/api/admin/reports/${id}`;

  const target = (x: (typeof rows)[number]) => {
    switch (x.targetType) {
      case "place": {
        const p = placeBy.get(x.targetId);
        if (!p) return null;
        return {
          title: placeName(locale, p) || p.slug,
          sub: null,
          edit: `${admin}/places/${p.id}`,
          editLabel: r.editTarget,
          view: `/${locale}/place/${p.slug}`,
        };
      }
      case "review": {
        const rv = reviewBy.get(x.targetId);
        if (!rv) return null;
        return { title: placeName(locale, rv), sub: rv.body, edit: `${admin}/reviews?tab=reported#review-${rv.id}`, editLabel: r.moderateReview, view: null };
      }
      case "submission": {
        const sb = subBy.get(x.targetId);
        if (!sb) return null;
        return { title: sb.name, sub: null, edit: `${admin}/submissions`, editLabel: t.admin.common.open, view: null };
      }
      case "event": {
        const ev = eventBy.get(x.targetId);
        if (!ev) return null;
        return { title: localized(locale, ev.titleEn, ev.titleAr) ?? ev.titleEn, sub: null, edit: `${admin}/events/${ev.id}`, editLabel: r.editTarget, view: null };
      }
    }
  };

  return (
    <div>
      <PageHeader title={r.title} lede={r.lede} />
      <LinkTabs
        label={r.title}
        tabs={[
          { href: base, label: r.tabOpen, active: tab === "open", count: countBy.open ? formatNumber(locale, countBy.open) : undefined },
          { href: `${base}?tab=resolved`, label: r.tabResolved, active: tab === "resolved" },
          { href: `${base}?tab=dismissed`, label: r.tabDismissed, active: tab === "dismissed" },
        ]}
      />

      {rows.length ? (
        <ul className="space-y-4">
          {rows.map((x) => {
            const tg = target(x);
            const place = x.targetType === "place" ? placeBy.get(x.targetId) : undefined;
            return (
              <li key={x.id} className="rounded-3xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{r.target[x.targetType]}</p>
                    {tg ? (
                      <p className="mt-0.5 font-semibold">{tg.title}</p>
                    ) : (
                      <p className="mt-0.5 text-sm text-ink-500">{r.targetMissing}</p>
                    )}
                    {tg?.sub && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{tg.sub}</p>}
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    {place?.flagged && (
                      <Badge tone="coral">
                        <AlertTriangle className="size-3" aria-hidden /> {t.admin.places.outdated}
                      </Badge>
                    )}
                    <Badge tone={STATUS_TONE[x.status]}>{t.admin.status[x.status]}</Badge>
                  </span>
                </div>

                <div className="mt-3 rounded-2xl bg-sand-100 p-3 text-sm">
                  <p className="font-medium text-ink-900">{reasons[x.reason] ?? x.reason}</p>
                  {x.details && <p className="mt-1 whitespace-pre-line text-ink-700">{x.details}</p>}
                  <p className="mt-2 text-xs text-ink-500">
                    {r.reportedBy.replace("{name}", x.reporterName ?? t.admin.common.anonymous)} · {formatDateTime(locale, x.createdAt, { timeStyle: "short" })}
                  </p>
                </div>

                {x.status !== "open" && (
                  <div className="mt-3 text-sm text-ink-700">
                    {x.resolvedAt && (
                      <p className="text-xs text-ink-500">
                        {r.resolvedBy
                          .replace("{status}", t.admin.status[x.status])
                          .replace("{name}", x.resolverName ?? "—")
                          .replace("{date}", formatDateTime(locale, x.resolvedAt))}
                      </p>
                    )}
                    {x.resolution && <p className="mt-1">{x.resolution}</p>}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-sand-100 pt-4">
                  {tg && (
                    <Link href={tg.edit} className="me-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-sea-600 hover:bg-sea-50">
                      {tg.editLabel}
                    </Link>
                  )}
                  {tg?.view && (
                    <Link href={tg.view} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-600 hover:bg-sand-100">
                      <ExternalLink className="size-3.5" aria-hidden /> {t.admin.common.viewOnSite}
                    </Link>
                  )}
                  {place && !place.flagged && x.status === "open" && (
                    <ActionButton
                      url={url(x.id)}
                      method="PATCH"
                      payload={{ action: "flag_place" }}
                      label={r.flagPlace}
                      done={r.placeFlagged}
                      variant="ghost"
                      icon={<AlertTriangle className="size-4" aria-hidden />}
                    />
                  )}
                  {x.status === "open" ? (
                    <>
                      <NoteAction
                        url={url(x.id)}
                        payload={{ action: "dismiss" }}
                        noteKey="resolution"
                        label={r.dismiss}
                        title={r.dismissTitle}
                        noteLabel={r.resolution}
                        noteHint={r.resolutionHint}
                        done={r.done}
                        variant="secondary"
                        icon={<XCircle className="size-4" aria-hidden />}
                      />
                      <NoteAction
                        url={url(x.id)}
                        payload={{ action: "resolve" }}
                        noteKey="resolution"
                        label={r.resolve}
                        title={r.resolveTitle}
                        noteLabel={r.resolution}
                        noteHint={r.resolutionHint}
                        done={r.done}
                        variant="primary"
                        icon={<CheckCircle2 className="size-4" aria-hidden />}
                      />
                    </>
                  ) : (
                    <ActionButton url={url(x.id)} method="PATCH" payload={{ action: "reopen" }} label={r.reopen} done={r.done} icon={<RotateCcw className="size-4" aria-hidden />} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>{r.empty}</EmptyState>
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(n) => hrefWith(base, { tab: tab === "open" ? undefined : tab }, { page: n })}
        labels={{
          previous: t.admin.common.previous,
          next: t.admin.common.next,
          pageOf: t.admin.common.pageOf.replace("{n}", formatNumber(locale, page)).replace("{total}", formatNumber(locale, pages)),
        }}
      />
    </div>
  );
}
