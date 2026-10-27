import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { BellRing, Plus, Search } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { likePattern } from "@/lib/admin/places";
import { EVENT_CATEGORIES } from "@/lib/taxonomy";
import { cityToday, formatDateTime, formatDay, formatNumber, localized, plural } from "@/lib/i18n/format";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Pagination, STATUS_TONE, flatParams, hrefWith, inputClass } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.events.title };
}

const PAGE_SIZE = 25;

export default async function AdminEvents({ searchParams }: PageProps<"/[lang]/admin/events">) {
  const raw = await searchParams;
  if (!(await requireAdminPage("/events", raw))) return null;
  const { t, locale } = await getDictionary();
  const a = t.admin.events;
  const sp = flatParams(raw);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = ["draft", "published", "archived"].includes(sp.status ?? "") ? (sp.status as "draft" | "published" | "archived") : undefined;
  const when = sp.when === "past" ? "past" : sp.when === "all" ? "all" : "upcoming";
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));
  const today = cityToday();

  const conds: SQL[] = [];
  if (q) {
    const pat = likePattern(q);
    conds.push(
      or(
        sql`${events.titleEn} like ${pat} escape '\\'`,
        sql`${events.titleAr} like ${pat} escape '\\'`,
        sql`${events.venueName} like ${pat} escape '\\'`,
        sql`${events.venueNameAr} like ${pat} escape '\\'`,
      )!,
    );
  }
  if (status) conds.push(eq(events.status, status));
  if (when === "upcoming") conds.push(gte(events.endDate, today));
  if (when === "past") conds.push(lt(events.endDate, today));
  const where = conds.length ? and(...conds) : undefined;

  const savesN = sql<number>`(select count(*) from event_saves es where es.event_id = ${events.id})`;
  const [[{ n: total }], [{ n: everything }], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(events).where(where),
    db.select({ n: sql<number>`count(*)` }).from(events),
    db
      .select({
        id: events.id,
        slug: events.slug,
        titleEn: events.titleEn,
        titleAr: events.titleAr,
        category: events.category,
        venueName: events.venueName,
        venueNameAr: events.venueNameAr,
        startDate: events.startDate,
        endDate: events.endDate,
        status: events.status,
        lastVerifiedAt: events.lastVerifiedAt,
        changedAt: events.changedAt,
        saves: savesN,
      })
      .from(events)
      .where(where)
      .orderBy(when === "past" ? desc(events.startDate) : asc(events.startDate), asc(events.titleEn))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);
  const count = Number(total);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const base = `/${locale}/admin/events`;
  const current = { q: q || undefined, status, when: when === "upcoming" ? undefined : when };
  const filtered = !!(q || status || when !== "upcoming");
  const select = `${inputClass} h-10 text-sm`;
  const catName = (slug: string) => EVENT_CATEGORIES.find((c) => c.slug === slug)?.name[locale] ?? slug;

  return (
    <div>
      <PageHeader
        title={a.title}
        lede={a.lede}
        actions={
          <ButtonLink href={`${base}/new`}>
            <Plus className="size-4" aria-hidden /> {a.new}
          </ButtonLink>
        }
      />

      <form method="get" action={base} role="search" aria-label={a.searchPlaceholder} className="mb-5 rounded-3xl bg-white p-4 shadow-card md:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{t.admin.common.search}</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input name="q" type="search" defaultValue={q} placeholder={a.searchPlaceholder} className={`${inputClass} h-10 ps-9 text-sm`} />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{a.filterWhen}</span>
            <select name="when" defaultValue={when} className={select}>
              <option value="upcoming">{a.whenUpcoming}</option>
              <option value="past">{a.whenPast}</option>
              <option value="all">{t.admin.common.all}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{t.admin.common.status}</span>
            <select name="status" defaultValue={status ?? ""} className={select}>
              <option value="">{t.admin.common.any}</option>
              <option value="published">{t.admin.status.published}</option>
              <option value="draft">{t.admin.status.draft}</option>
              <option value="archived">{t.admin.status.archived}</option>
            </select>
          </label>
          <span className="flex gap-2">
            {filtered && (
              <Link href={base} className={buttonClass("ghost", "sm", "h-10")}>
                {t.admin.common.resetFilters}
              </Link>
            )}
            <button type="submit" className={buttonClass("dark", "sm", "h-10")}>
              {t.admin.common.applyFilters}
            </button>
          </span>
        </div>
      </form>

      <p className="mb-3 text-sm text-ink-500" aria-live="polite">
        {plural(locale, count, t.admin.common.results)}
      </p>

      {rows.length ? (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-xs text-ink-500">
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {a.colTitle}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {a.colDates}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {a.colVenue}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {t.admin.common.status}
                </th>
                <th scope="col" className="px-3 py-3 text-end font-medium">
                  {a.colSaves}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  {a.colVerified}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-sand-100 align-top last:border-0 hover:bg-sand-50">
                  <td className="px-4 py-3">
                    <Link href={`${base}/${r.id}`} className="font-semibold hover:text-sea-600 hover:underline">
                      {localized(locale, r.titleEn, r.titleAr)}
                    </Link>
                    <span className="block text-xs text-ink-500">{catName(r.category)}</span>
                    {r.changedAt && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-gold-500">
                        <BellRing className="size-3" aria-hidden /> {formatDateTime(locale, r.changedAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {r.startDate === r.endDate ? formatDay(locale, r.startDate, { year: "numeric" }) : `${formatDay(locale, r.startDate)} – ${formatDay(locale, r.endDate, { year: "numeric" })}`}
                  </td>
                  <td className="px-3 py-3 text-ink-700">{localized(locale, r.venueName, r.venueNameAr)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{t.admin.status[r.status]}</Badge>
                  </td>
                  <td className="px-3 py-3 text-end tabular-nums">{formatNumber(locale, Number(r.saves))}</td>
                  <td className="px-4 py-3 text-end text-xs text-ink-500">{r.lastVerifiedAt ? formatDateTime(locale, r.lastVerifiedAt) : t.admin.common.never}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          action={
            !Number(everything) ? (
              <ButtonLink href={`${base}/new`} variant="secondary">
                <Plus className="size-4" aria-hidden /> {a.new}
              </ButtonLink>
            ) : undefined
          }
        >
          {Number(everything) ? t.admin.common.emptyFilters : a.emptyList}
        </EmptyState>
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(n) => hrefWith(base, current, { page: n })}
        labels={{
          previous: t.admin.common.previous,
          next: t.admin.common.next,
          pageOf: t.admin.common.pageOf.replace("{n}", formatNumber(locale, page)).replace("{total}", formatNumber(locale, pages)),
        }}
      />
    </div>
  );
}
