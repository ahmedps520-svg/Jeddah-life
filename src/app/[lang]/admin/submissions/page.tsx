import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { ExternalLink, MapPin } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { places, submissions, users } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import type { PlaceHit } from "@/lib/admin/types";
import { getCatalog } from "@/lib/places/catalog";
import { GEM_TYPES } from "@/lib/taxonomy";
import { formatDateTime, formatNumber, placeName } from "@/lib/i18n/format";
import { Badge, EmptyState, LinkTabs, PageHeader, Pagination, STATUS_TONE, flatParams, hrefWith } from "@/components/admin/ui";
import { SubmissionReview } from "@/components/admin/submission-review";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.submissions.title };
}

const PAGE_SIZE = 20;
type Tab = "pending" | "approved" | "rejected";

export default async function AdminSubmissions({ searchParams }: PageProps<"/[lang]/admin/submissions">) {
  const raw = await searchParams;
  if (!(await requireAdminPage("/submissions", raw))) return null;
  const { t, locale } = await getDictionary();
  const s = t.admin.submissions;
  const sp = flatParams(raw);
  const tab: Tab = sp.tab === "approved" || sp.tab === "rejected" ? sp.tab : "pending";
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));

  const reviewer = alias(users, "reviewer");
  const [counts, rows, catalog] = await Promise.all([
    db.select({ status: submissions.status, n: sql<number>`count(*)` }).from(submissions).groupBy(submissions.status),
    db
      .select({
        id: submissions.id,
        name: submissions.name,
        gemType: submissions.gemType,
        description: submissions.description,
        tips: submissions.tips,
        lat: submissions.lat,
        lng: submissions.lng,
        neighbourhood: submissions.neighbourhood,
        photos: submissions.photos,
        status: submissions.status,
        moderatorNote: submissions.moderatorNote,
        reviewedAt: submissions.reviewedAt,
        placeId: submissions.placeId,
        createdAt: submissions.createdAt,
        author: users.displayName,
        email: users.email,
        reviewerName: reviewer.displayName,
      })
      .from(submissions)
      .innerJoin(users, eq(users.id, submissions.userId))
      .leftJoin(reviewer, eq(reviewer.id, submissions.reviewedBy))
      .where(eq(submissions.status, tab))
      .orderBy(tab === "pending" ? submissions.createdAt : desc(submissions.reviewedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    getCatalog(),
  ]);

  const placeIds = rows.map((r) => r.placeId).filter((x): x is string => !!x);
  const linked = placeIds.length
    ? await db
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
        .where(inArray(places.id, placeIds))
    : [];
  const placeById = new Map<string, PlaceHit>(linked.map((p) => [p.id, p]));

  const countBy = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Record<string, number>;
  const total = countBy[tab] ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/${locale}/admin/submissions`;
  const hoods = catalog.hoods
    .map((h) => ({ slug: h.slug, name: locale === "ar" ? h.nameAr || h.nameEn : h.nameEn }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const hoodName = (slug: string | null) => (slug ? (hoods.find((h) => h.slug === slug)?.name ?? slug) : null);
  const gemType = (slug: string) => GEM_TYPES.find((g) => g.slug === slug)?.name[locale] ?? slug;

  return (
    <div>
      <PageHeader title={s.title} lede={s.lede} />
      <LinkTabs
        label={s.title}
        tabs={[
          { href: base, label: s.tabPending, active: tab === "pending", count: countBy.pending ? formatNumber(locale, countBy.pending) : undefined },
          { href: `${base}?tab=approved`, label: s.tabApproved, active: tab === "approved" },
          { href: `${base}?tab=rejected`, label: s.tabRejected, active: tab === "rejected" },
        ]}
      />

      {rows.length ? (
        <ul className="space-y-4">
          {rows.map((x) => {
            const place = x.placeId ? (placeById.get(x.placeId) ?? null) : null;
            return (
              <li key={x.id} className="rounded-3xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold">{x.name}</h2>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-500">
                      <span>{t.admin.common.by.replace("{name}", x.author)}</span>
                      <span dir="ltr">{x.email}</span>
                      <span>· {formatDateTime(locale, x.createdAt)}</span>
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{gemType(x.gemType)}</Badge>
                    <Badge tone={STATUS_TONE[x.status]}>{t.admin.status[x.status]}</Badge>
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-[15px] text-ink-800">{x.description}</p>
                {x.tips && (
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-600">
                    <span className="font-medium text-ink-800">{s.tips}:</span> {x.tips}
                  </p>
                )}
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                    <div>
                      <dt className="sr-only">{s.location}</dt>
                      <dd>
                        {x.lat != null && x.lng != null ? (
                          <>
                            {hoodName(x.neighbourhood) && <span className="me-1">{hoodName(x.neighbourhood)} ·</span>}
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${x.lat}&mlon=${x.lng}#map=17/${x.lat}/${x.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              dir="ltr"
                              className="inline-flex items-center gap-1 text-sea-600 hover:underline"
                            >
                              {x.lat.toFixed(5)}, {x.lng.toFixed(5)} <ExternalLink className="size-3" aria-hidden />
                            </a>
                          </>
                        ) : (
                          <span className="text-ink-500">{hoodName(x.neighbourhood) ?? s.noLocation}</span>
                        )}
                      </dd>
                    </div>
                  </div>
                  {place && (
                    <div>
                      <dt className="text-xs text-ink-500">{x.status === "approved" ? s.linkedPlace : s.suggestedPlace}</dt>
                      <dd>
                        <Link href={`/${locale}/admin/places/${place.id}`} className="font-medium text-sea-600 hover:underline">
                          {placeName(locale, place) || place.slug}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
                {x.photos.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label={s.photos}>
                    {x.photos.map((ph) => (
                      <li key={ph.url}>
                        <a href={ph.url} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-xl bg-sand-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.url} alt="" className="size-full object-cover" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {x.status !== "pending" && (
                  <div className="mt-3 rounded-2xl bg-sand-100 p-3 text-sm text-ink-700">
                    {x.reviewedAt && (
                      <p className="text-xs text-ink-500">
                        {s.reviewedBy.replace("{name}", x.reviewerName ?? "—").replace("{date}", formatDateTime(locale, x.reviewedAt))}
                      </p>
                    )}
                    {x.moderatorNote && <p className="mt-1">{x.moderatorNote}</p>}
                  </div>
                )}
                {x.status === "pending" && (
                  <div className="mt-4 border-t border-sand-100 pt-4">
                    <SubmissionReview
                      hoods={hoods}
                      sub={{
                        id: x.id,
                        name: x.name,
                        description: x.description,
                        tips: x.tips,
                        lat: x.lat,
                        lng: x.lng,
                        neighbourhood: x.neighbourhood,
                        photoCount: x.photos.length,
                        suggested: place,
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>{s.empty}</EmptyState>
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(n) => hrefWith(base, { tab: tab === "pending" ? undefined : tab }, { page: n })}
        labels={{
          previous: t.admin.common.previous,
          next: t.admin.common.next,
          pageOf: t.admin.common.pageOf.replace("{n}", formatNumber(locale, page)).replace("{total}", formatNumber(locale, pages)),
        }}
      />
    </div>
  );
}
