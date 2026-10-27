import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { requireAdminPage } from "@/lib/admin/guard";
import { getDashboard, type RankedPlace } from "@/lib/admin/dashboard";
import { formatDateTime, formatNumber, placeName, plural } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { Badge, cardClass, LinkTabs, PageHeader, StatCard } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.dashboard.title };
}

function RankTable({
  rows,
  locale,
  valueLabel,
  empty,
  nameLabel,
}: {
  rows: RankedPlace[];
  locale: Locale;
  valueLabel: string;
  empty: string;
  nameLabel: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-500">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-sand-200 text-start text-xs text-ink-500">
          <th scope="col" className="w-8 py-2 text-start font-medium">
            #
          </th>
          <th scope="col" className="py-2 text-start font-medium">
            {nameLabel}
          </th>
          <th scope="col" className="py-2 text-end font-medium">
            {valueLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className="border-b border-sand-100 last:border-0">
            <td className="py-2 text-ink-400 tabular-nums">{formatNumber(locale, i + 1)}</td>
            <td className="py-2">
              <Link href={`/${locale}/admin/places/${r.id}`} className="font-medium hover:text-sea-600 hover:underline">
                {placeName(locale, r) || r.slug}
              </Link>
            </td>
            <td className="py-2 text-end font-medium tabular-nums">{formatNumber(locale, r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminDashboard({ searchParams }: PageProps<"/[lang]/admin">) {
  const sp = await searchParams;
  if (!(await requireAdminPage("", sp))) return null;
  const { t, locale } = await getDictionary();
  const d = t.admin.dashboard;
  const range = sp.range === "30" ? 30 : 7;
  const data = await getDashboard(range);
  const f = (n: number) => formatNumber(locale, n);
  const base = `/${locale}/admin`;

  const v = data.verification;
  const vTotal = v.verified + v.unverified + v.community;
  const pct = (x: number) => (vTotal ? Math.round((x / vTotal) * 100) : 0);

  return (
    <div className="space-y-8">
      <PageHeader title={d.title} lede={d.lede} />

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="sr-only">
          {d.title}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={d.users} value={f(data.users)} sub={plural(locale, data.admins, d.admins)} href={`${base}/users`} />
          <StatCard
            label={d.places}
            value={f(data.places.published)}
            sub={`${d.published} · ${f(data.places.draft)} ${d.drafts} · ${f(data.places.archived)} ${d.archived}`}
            href={`${base}/places`}
          />
          <StatCard label={d.reviews} value={f(data.reviews.total)} sub={d.reviewsLast30.replace("{n}", f(data.reviews.last30))} href={`${base}/reviews?tab=recent`} />
          <StatCard label={d.saves} value={f(data.saves)} sub={d.eventSaves.replace("{n}", f(data.eventSaves))} />
          <StatCard label={d.openReports} value={f(data.openReports)} href={`${base}/reports`} tone={data.openReports ? "alert" : "default"} />
          <StatCard label={d.pendingSubmissions} value={f(data.pendingSubs)} href={`${base}/submissions`} tone={data.pendingSubs ? "alert" : "default"} />
          <StatCard label={d.upcomingEvents} value={f(data.upcomingEvents)} href={`${base}/events`} />
          <div className="rounded-2xl bg-white p-4 shadow-card md:p-5">
            <span className="block text-sm text-ink-500">{d.verifiedSplit}</span>
            {vTotal ? (
              <>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-sand-200" aria-hidden>
                  <span className="bg-sea-500" style={{ width: `${pct(v.verified)}%` }} />
                  <span className="bg-gold-400" style={{ width: `${pct(v.community)}%` }} />
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-ink-600">
                      <span className="size-2 rounded-full bg-sea-500" aria-hidden />
                      {d.verified}
                    </dt>
                    <dd className="font-medium tabular-nums">{f(v.verified)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-ink-600">
                      <span className="size-2 rounded-full bg-gold-400" aria-hidden />
                      {d.community}
                    </dt>
                    <dd className="font-medium tabular-nums">{f(v.community)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-ink-600">
                      <span className="size-2 rounded-full bg-sand-300" aria-hidden />
                      {d.unverified}
                    </dt>
                    <dd className="font-medium tabular-nums">{f(v.unverified)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-500">{t.admin.common.noDataYet}</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={cardClass} aria-labelledby="searches-title">
          <h2 id="searches-title" className="font-display text-xl font-semibold">
            {d.topSearches}
          </h2>
          {data.topSearches.length ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-xs text-ink-500">
                  <th scope="col" className="py-2 text-start font-medium">
                    {d.query}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {d.searches}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {d.avgResults}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topSearches.map((s) => (
                  <tr key={s.normalized} className="border-b border-sand-100 last:border-0">
                    <td className="py-2">
                      <bdi>{s.query}</bdi>
                    </td>
                    <td className="py-2 text-end font-medium tabular-nums">{f(s.n)}</td>
                    <td className={`py-2 text-end tabular-nums ${s.avg < 1 ? "text-coral-500" : "text-ink-600"}`}>
                      {formatNumber(locale, Math.round(s.avg * 10) / 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-ink-500">{d.topSearchesEmpty}</p>
          )}
        </section>

        <section className={cardClass} aria-labelledby="zero-title">
          <h2 id="zero-title" className="font-display text-xl font-semibold">
            {d.zeroResults}
          </h2>
          {data.zeroSearches.length ? (
            <ul className="mt-3 divide-y divide-sand-100 text-sm">
              {data.zeroSearches.map((s) => (
                <li key={s.normalized} className="flex items-center justify-between gap-3 py-2">
                  <bdi>{s.query}</bdi>
                  <span className="font-medium tabular-nums">{f(s.n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink-500">{data.topSearches.length ? d.zeroResultsEmpty : d.topSearchesEmpty}</p>
          )}
        </section>
      </div>

      <section aria-labelledby="popular-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="popular-title" className="font-display text-2xl font-semibold">
            {d.mostViewed} · {d.mostSaved}
          </h2>
          <LinkTabs
            label={d.mostViewed}
            tabs={[
              { href: base, label: d.last7, active: range === 7 },
              { href: `${base}?range=30`, label: d.last30, active: range === 30 },
            ]}
          />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className={cardClass}>
            <h3 className="mb-2 font-semibold">{d.mostViewed}</h3>
            <RankTable rows={data.viewed} locale={locale} valueLabel={d.views} empty={d.statsEmpty} nameLabel={t.admin.places.colName} />
          </div>
          <div className={cardClass}>
            <h3 className="mb-2 font-semibold">{d.mostSaved}</h3>
            <RankTable rows={data.saved} locale={locale} valueLabel={d.savesCol} empty={d.statsEmpty} nameLabel={t.admin.places.colName} />
          </div>
        </div>
      </section>

      <section className={cardClass} aria-labelledby="stale-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="stale-title" className="font-display text-xl font-semibold">
              {d.stale}
            </h2>
            <p className="mt-1 text-sm text-ink-500">{d.staleLede}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone={data.stale.old ? "gold" : "neutral"}>
              <Clock className="size-3.5" aria-hidden /> {d.staleOld}: {f(data.stale.old)}
            </Badge>
            <Badge tone={data.stale.flagged ? "coral" : "neutral"}>
              <AlertTriangle className="size-3.5" aria-hidden /> {d.staleFlagged}: {f(data.stale.flagged)}
            </Badge>
          </div>
        </div>
        {data.stale.list.length ? (
          <>
            <ul className="mt-4 divide-y divide-sand-100">
              {data.stale.list.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`${base}/places/${p.id}`} className="font-medium hover:text-sea-600 hover:underline">
                    {placeName(locale, p) || p.slug}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-ink-500">
                    {p.flaggedOutdated && <Badge tone="coral">{d.flagged}</Badge>}
                    {p.lastVerifiedAt && d.verifiedOn.replace("{date}", formatDateTime(locale, p.lastVerifiedAt))}
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`${base}/places?stale=1`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sea-600 hover:underline">
              {d.staleAll} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink-500">{d.staleEmpty}</p>
        )}
      </section>
    </div>
  );
}
