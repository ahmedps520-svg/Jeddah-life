import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Clock, Lightbulb, MapPin, Navigation, Users } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { fmt, formatDateTime, placeName } from "@/lib/i18n/format";
import { directionsUrl } from "@/lib/map/style";
import { gemTypeName } from "@/components/gems/gem-card";
import { CoverArt } from "@/components/place/cover-art";
import { ReportButton } from "@/components/place/personal-tools";
import { MiniMap } from "@/components/map/mini-map";
import { buttonClass } from "@/components/ui/button";

async function load(id: string) {
  const [s] = await db.select().from(submissions).where(eq(submissions.id, id));
  return s ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/hidden-gems/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await load(id);
  if (!s || s.status !== "approved") return { robots: { index: false } };
  return { title: s.name, description: s.description.slice(0, 160) };
}

export default async function GemPage({ params }: PageProps<"/[lang]/hidden-gems/[id]">) {
  const { t, locale } = await getDictionary();
  const { id } = await params;
  const [s, user] = await Promise.all([load(id), getCurrentUser()]);
  // Pending and rejected recommendations are visible only to their author and admins.
  if (!s || (s.status !== "approved" && s.userId !== user?.id && user?.role !== "admin")) notFound();

  const catalog = await getCatalog();
  const place = s.placeId ? catalog.byId.get(s.placeId) : null;
  const hood = s.neighbourhood ? catalog.hoodBySlug.get(s.neighbourhood) : null;
  const hoodName = hood ? (locale === "ar" ? hood.nameAr || hood.nameEn : hood.nameEn) : null;
  const photo = s.photos[0];

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      {s.status !== "approved" && (
        <p className="mb-6 rounded-2xl bg-gold-400/15 p-4 text-sm text-ink-800">
          {s.status === "pending" ? t.gems.pendingBanner : t.gems.rejectedBanner}
          {s.status === "rejected" && s.moderatorNote ? ` ${s.moderatorNote}` : ""}
        </p>
      )}
      <Link href={`/${locale}/hidden-gems`} className="text-sm text-sea-600 hover:underline">
        {t.gems.title}
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-ink-800">
            {photo ? (
              <Image src={photo.url} alt="" fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
            ) : (
              <CoverArt seed={s.id} category="hidden-gems" initial={s.name} className="absolute inset-0 size-full" />
            )}
          </div>
          {s.photos.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              {s.photos.slice(1).map((p) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-ink-800">
                  <Image src={p.url} alt="" fill sizes="200px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
          <header>
            <p className="text-sm font-semibold uppercase tracking-wider text-coral-500">{gemTypeName(s.gemType, locale)}</p>
            <h1 className="mt-1 font-display text-[34px] font-semibold leading-tight md:text-[44px]" dir="auto">
              {s.name}
            </h1>
            {hoodName && (
              <p className="mt-1 flex items-center gap-1.5 text-ink-500">
                <MapPin className="size-4" /> {hoodName}
              </p>
            )}
          </header>
          <p className="flex items-start gap-2 rounded-2xl bg-sea-50 p-4 text-sm text-ink-700">
            <Users className="mt-0.5 size-4 shrink-0 text-sea-600" />
            <span>
              <strong className="font-semibold">{t.gems.community}.</strong> {t.gems.communityNote}
            </span>
          </p>
          <p className="max-w-prose whitespace-pre-line text-[17px] leading-relaxed text-ink-800" dir="auto">
            {s.description}
          </p>
          {s.tips && (
            <section className="rounded-2xl bg-white p-5 shadow-card">
              <h2 className="flex items-center gap-2 font-semibold">
                <Lightbulb className="size-4 text-gold-500" /> {t.gems.tips}
              </h2>
              <p className="mt-2 whitespace-pre-line text-ink-700" dir="auto">
                {s.tips}
              </p>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          {s.lat != null && s.lng != null && (
            <>
              <MiniMap className="h-64" ariaLabel={s.name} markers={[{ id: s.id, lat: s.lat, lng: s.lng, color: "#2C7A7B", label: s.name }]} />
              <a href={directionsUrl(s.lat, s.lng)} target="_blank" rel="noreferrer" className={`${buttonClass("dark")} w-full justify-center`}>
                <Navigation className="size-[18px]" /> {t.common.directions}
              </a>
            </>
          )}
          {place && (
            <Link href={`/${locale}/place/${place.slug}`} className="block rounded-2xl bg-white p-4 ring-1 ring-sand-200 transition hover:ring-ink-300">
              <span className="block text-xs font-semibold uppercase tracking-wider text-ink-400">{t.gems.linkedPlace}</span>
              <span className="mt-0.5 block font-medium text-sea-700">{placeName(locale, place)}</span>
            </Link>
          )}
          <div className="space-y-2 rounded-2xl bg-sand-200/60 p-4 text-sm text-ink-600">
            <p className="flex items-center gap-1.5">
              <Clock className="size-4" /> {fmt(t.gems.recommendedOn, { date: formatDateTime(locale, s.createdAt) })}
            </p>
            {s.status === "approved" && <ReportButton targetType="submission" targetId={s.id} />}
          </div>
        </aside>
      </div>
    </article>
  );
}
