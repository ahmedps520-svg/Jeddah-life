import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, ExternalLink, Gem, Sparkles } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { places, reports, reviews, saves } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { getCurrentUser } from "@/lib/auth/session";
import { placeToForm } from "@/lib/admin/places";
import { getCatalog } from "@/lib/places/catalog";
import { formatDateTime, placeName, plural } from "@/lib/i18n/format";
import { Badge, PageHeader, STATUS_TONE, cardClass } from "@/components/admin/ui";
import { PlaceForm } from "@/components/admin/place-form";
import { PlaceActions } from "@/components/admin/place-actions";

async function load(id: string) {
  const [p] = await db.select().from(places).where(eq(places.id, id));
  return p ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/places/[id]">): Promise<Metadata> {
  const { t, locale } = await getDictionary();
  if ((await getCurrentUser())?.role !== "admin") return { title: t.admin.title };
  const p = await load((await params).id);
  return { title: p ? placeName(locale, p) || t.admin.places.editTitle : t.admin.places.editTitle };
}

export default async function EditPlace({ params }: PageProps<"/[lang]/admin/places/[id]">) {
  const { id } = await params;
  if (!(await requireAdminPage(`/places/${id}`))) return null;
  const { t, locale } = await getDictionary();
  const a = t.admin.places;
  const p = await load(id);
  if (!p) notFound();

  const n = sql<number>`count(*)`;
  const [[savesN], [reviewsN], [reportsN], catalog] = await Promise.all([
    db.select({ n }).from(saves).where(eq(saves.placeId, id)),
    db.select({ n }).from(reviews).where(eq(reviews.placeId, id)),
    db.select({ n }).from(reports).where(and(eq(reports.targetType, "place"), eq(reports.targetId, id), eq(reports.status, "open"))),
    getCatalog(),
  ]);
  const hoods = catalog.hoods
    .map((h) => ({ slug: h.slug, name: locale === "ar" ? h.nameAr || h.nameEn : h.nameEn }))
    .sort((x, y) => x.name.localeCompare(y.name, locale));
  const name = placeName(locale, p) || a.noName;
  const openReports = Number(reportsN?.n ?? 0);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-2 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 text-end font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={name}
        back={{ href: `/${locale}/admin/places`, label: a.title }}
        lede={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[p.status]}>{t.admin.status[p.status]}</Badge>
            <Badge tone={STATUS_TONE[p.verification]}>
              {p.verification === "verified" && <BadgeCheck className="size-3" aria-hidden />}
              {t.admin.verification[p.verification]}
            </Badge>
            {p.editorsPick && (
              <Badge tone="gold">
                <Sparkles className="size-3" aria-hidden /> {a.pick}
              </Badge>
            )}
            {p.hiddenGem && (
              <Badge tone="sea">
                <Gem className="size-3" aria-hidden /> {a.gem}
              </Badge>
            )}
            {p.flaggedOutdated && (
              <Badge tone="coral">
                <AlertTriangle className="size-3" aria-hidden /> {a.outdated}
              </Badge>
            )}
          </span>
        }
        actions={
          <Link
            href={`/${locale}/place/${p.slug}`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium ring-1 ring-sand-300 hover:ring-ink-300"
          >
            <ExternalLink className="size-4" aria-hidden /> {t.admin.common.viewOnSite}
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 min-w-0 xl:order-1">
          <PlaceForm placeId={p.id} initial={placeToForm(p)} hoods={hoods} />
        </div>
        <aside className="order-1 space-y-4 xl:order-2">
          <div className={`${cardClass} xl:sticky xl:top-[calc(var(--header-h)+24px)]`}>
            <h2 className="font-display text-lg font-semibold">{a.verifiedState}</h2>
            <p className="mt-1 text-sm text-ink-600">
              {p.lastVerifiedAt ? a.lastVerifiedOn.replace("{date}", formatDateTime(locale, p.lastVerifiedAt)) : a.neverVerified}
            </p>
            <div className="mt-4">
              <PlaceActions id={p.id} slug={p.slug} status={p.status} />
            </div>
            <h2 className="mt-6 font-display text-lg font-semibold">{a.meta}</h2>
            <dl className="mt-1 divide-y divide-sand-100">
              {row(a.source, (a.sourceKinds as Record<string, string>)[p.source] ?? p.source)}
              {p.sourceRef && row(a.sourceRef, <span dir="ltr">{p.sourceRef}</span>)}
              {row(a.slug, <span dir="ltr">{p.slug}</span>)}
              {row(t.admin.common.copyId, <span dir="ltr">{p.id}</span>)}
              {row(a.createdAt, formatDateTime(locale, p.createdAt))}
              {row(a.updatedAt, formatDateTime(locale, p.updatedAt, { timeStyle: "short" }))}
            </dl>
            <ul className="mt-3 space-y-1 text-sm text-ink-600">
              <li>{plural(locale, Number(savesN?.n ?? 0), a.savesCount)}</li>
              <li>{plural(locale, Number(reviewsN?.n ?? 0), a.reviewsCount)}</li>
              <li>
                {openReports ? (
                  <Link href={`/${locale}/admin/reports`} className="font-medium text-coral-500 hover:underline">
                    {plural(locale, openReports, a.openReports)}
                  </Link>
                ) : (
                  plural(locale, 0, a.openReports)
                )}
              </li>
            </ul>
            {p.sourceDetail && <p className="mt-3 rounded-xl bg-sand-100 p-3 text-xs text-ink-600">{p.sourceDetail}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
