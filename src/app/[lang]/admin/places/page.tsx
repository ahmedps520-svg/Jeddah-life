import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, Gem, Plus, Search, Sparkles } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { neighbourhoods, places } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { staleCondition } from "@/lib/admin/dashboard";
import { likePattern } from "@/lib/admin/places";
import { PLACE_CATEGORIES, categoryDef, subcategoryLabel } from "@/lib/taxonomy";
import { formatDateTime, formatNumber, placeName, plural } from "@/lib/i18n/format";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Pagination, STATUS_TONE, flatParams, hrefWith, inputClass } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.places.title };
}

const PAGE_SIZE = 25;

export default async function AdminPlaces({ searchParams }: PageProps<"/[lang]/admin/places">) {
  const raw = await searchParams;
  if (!(await requireAdminPage("/places", raw))) return null;
  const { t, locale } = await getDictionary();
  const p = t.admin.places;
  const sp = flatParams(raw);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = ["draft", "published", "archived"].includes(sp.status ?? "") ? (sp.status as "draft" | "published" | "archived") : undefined;
  const ver = ["verified", "unverified", "community"].includes(sp.ver ?? "") ? (sp.ver as "verified" | "unverified" | "community") : undefined;
  const cat = PLACE_CATEGORIES.some((c) => c.slug === sp.cat) ? sp.cat : undefined;
  const flagged = sp.flagged === "1";
  const stale = sp.stale === "1";
  const pick = sp.pick === "1";
  const gem = sp.gem === "1";
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));

  const conds: SQL[] = [];
  if (q) {
    const pat = likePattern(q);
    conds.push(
      or(
        sql`${places.nameEn} like ${pat} escape '\\'`,
        sql`${places.nameAr} like ${pat} escape '\\'`,
        sql`${places.slug} like ${pat} escape '\\'`,
        eq(places.id, q),
      )!,
    );
  }
  if (status) conds.push(eq(places.status, status));
  if (ver) conds.push(eq(places.verification, ver));
  if (cat) conds.push(eq(places.category, cat));
  if (flagged) conds.push(eq(places.flaggedOutdated, true));
  if (stale) conds.push(staleCondition()!);
  if (pick) conds.push(eq(places.editorsPick, true));
  if (gem) conds.push(eq(places.hiddenGem, true));
  const where = conds.length ? and(...conds) : undefined;

  const [[{ n: total }], rows, hoodRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(places).where(where),
    db
      .select({
        id: places.id,
        slug: places.slug,
        nameEn: places.nameEn,
        nameAr: places.nameAr,
        category: places.category,
        subcategory: places.subcategory,
        neighbourhood: places.neighbourhood,
        status: places.status,
        verification: places.verification,
        lastVerifiedAt: places.lastVerifiedAt,
        editorsPick: places.editorsPick,
        hiddenGem: places.hiddenGem,
        flaggedOutdated: places.flaggedOutdated,
        updatedAt: places.updatedAt,
      })
      .from(places)
      .where(where)
      .orderBy(desc(places.updatedAt), places.slug)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ slug: neighbourhoods.slug, nameEn: neighbourhoods.nameEn, nameAr: neighbourhoods.nameAr }).from(neighbourhoods),
  ]);
  const hoods = new Map(hoodRows.map((h) => [h.slug, locale === "ar" ? h.nameAr || h.nameEn : h.nameEn]));
  const count = Number(total);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const base = `/${locale}/admin/places`;
  const current = { q: q || undefined, status, ver, cat, flagged: flagged ? "1" : undefined, stale: stale ? "1" : undefined, pick: pick ? "1" : undefined, gem: gem ? "1" : undefined };
  const filtered = Object.values(current).some(Boolean);

  const quick = [
    { label: t.admin.common.all, href: base, active: !filtered },
    { label: t.admin.status.draft, href: `${base}?status=draft`, active: status === "draft" && Object.values(current).filter(Boolean).length === 1 },
    { label: t.admin.verification.unverified, href: `${base}?ver=unverified&status=published`, active: false },
    { label: p.filterFlagged, href: `${base}?flagged=1`, active: flagged && Object.values(current).filter(Boolean).length === 1 },
    { label: t.admin.dashboard.stale, href: `${base}?stale=1`, active: stale && Object.values(current).filter(Boolean).length === 1 },
    { label: t.admin.status.archived, href: `${base}?status=archived`, active: status === "archived" && Object.values(current).filter(Boolean).length === 1 },
  ];

  const select = `${inputClass} h-10 text-sm`;

  return (
    <div>
      <PageHeader
        title={p.title}
        lede={p.lede}
        actions={
          <ButtonLink href={`${base}/new`}>
            <Plus className="size-4" aria-hidden /> {p.new}
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {quick.map((x) => (
          <Link
            key={x.label}
            href={x.href}
            aria-current={x.active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${x.active ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-sand-200 hover:ring-ink-300"}`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <form method="get" action={base} className="mb-5 rounded-3xl bg-white p-4 shadow-card md:p-5" role="search" aria-label={p.searchLabel}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{p.searchLabel}</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input name="q" defaultValue={q} placeholder={p.searchPlaceholder} className={`${inputClass} h-10 ps-9 text-sm`} type="search" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{p.filterStatus}</span>
            <select name="status" defaultValue={status ?? ""} className={select}>
              <option value="">{t.admin.common.any}</option>
              <option value="published">{t.admin.status.published}</option>
              <option value="draft">{t.admin.status.draft}</option>
              <option value="archived">{t.admin.status.archived}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{p.filterVerification}</span>
            <select name="ver" defaultValue={ver ?? ""} className={select}>
              <option value="">{t.admin.common.any}</option>
              <option value="verified">{t.admin.verification.verified}</option>
              <option value="unverified">{t.admin.verification.unverified}</option>
              <option value="community">{t.admin.verification.community}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{p.filterCategory}</span>
            <select name="cat" defaultValue={cat ?? ""} className={select}>
              <option value="">{t.admin.common.any}</option>
              {PLACE_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name[locale]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {(
            [
              ["flagged", flagged, p.filterFlagged],
              ["stale", stale, p.filterStale],
              ["pick", pick, p.filterPick],
              ["gem", gem, p.filterGem],
            ] as const
          ).map(([name, on, label]) => (
            <label key={name} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name={name} value="1" defaultChecked={on} className="size-4 accent-sea-500" />
              {label}
            </label>
          ))}
          <span className="ms-auto flex gap-2">
            {filtered && (
              <Link href={base} className={buttonClass("ghost", "sm")}>
                {t.admin.common.resetFilters}
              </Link>
            )}
            <button type="submit" className={buttonClass("dark", "sm")}>
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
                  {p.colName}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {p.colCategory}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {p.colArea}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {p.colStatus}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {p.colVerification}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  {p.colUpdated}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = placeName(locale, r);
                const other = locale === "ar" ? r.nameEn : r.nameAr;
                const def = categoryDef(r.category);
                return (
                  <tr key={r.id} className="border-b border-sand-100 align-top last:border-0 hover:bg-sand-50">
                    <td className="px-4 py-3">
                      <Link href={`${base}/${r.id}`} className="font-semibold text-ink-900 hover:text-sea-600 hover:underline">
                        {name || p.noName}
                      </Link>
                      {other && other !== name && <span className="block text-xs text-ink-500">{other}</span>}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {r.editorsPick && (
                          <Badge tone="gold">
                            <Sparkles className="size-3" aria-hidden /> {p.pick}
                          </Badge>
                        )}
                        {r.hiddenGem && (
                          <Badge tone="sea">
                            <Gem className="size-3" aria-hidden /> {p.gem}
                          </Badge>
                        )}
                        {r.flaggedOutdated && (
                          <Badge tone="coral">
                            <AlertTriangle className="size-3" aria-hidden /> {p.outdated}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: def.color }} aria-hidden />
                        {def.name[locale]}
                      </span>
                      {r.subcategory && <span className="block text-xs text-ink-500">{subcategoryLabel(r.subcategory, locale) ?? r.subcategory}</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{r.neighbourhood ? (hoods.get(r.neighbourhood) ?? r.neighbourhood) : "—"}</td>
                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[r.status]}>{t.admin.status[r.status]}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[r.verification]}>
                        {r.verification === "verified" && <BadgeCheck className="size-3" aria-hidden />}
                        {t.admin.verification[r.verification]}
                      </Badge>
                      {r.lastVerifiedAt && <span className="mt-1 block text-xs text-ink-500">{formatDateTime(locale, r.lastVerifiedAt)}</span>}
                    </td>
                    <td className="px-4 py-3 text-end text-xs text-ink-500">{formatDateTime(locale, r.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{filtered ? t.admin.common.emptyFilters : t.admin.common.noDataYet}</EmptyState>
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
