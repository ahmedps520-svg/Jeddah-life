import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { AlertTriangle, CalendarDays, Clock, ExternalLink, MapPin, Ticket, Users } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getEvent } from "@/lib/events";
import { db } from "@/lib/db";
import { eventSaves } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { EVENT_CATEGORIES } from "@/lib/taxonomy";
import { cityToday, formatDateTime, formatSar, formatSarRange, localized, placeName } from "@/lib/i18n/format";
import { EventDateRange } from "@/components/events/event-card";
import { SaveEventButton } from "@/components/events/save-event";
import { ReportButton } from "@/components/place/personal-tools";
import { CoverArt } from "@/components/place/cover-art";
import { MiniMap } from "@/components/map/mini-map";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/[lang]/events/[slug]">): Promise<Metadata> {
  const { locale } = await getDictionary();
  const { slug } = await params;
  const e = await getEvent(slug);
  if (!e) return {};
  return { title: localized(locale, e.titleEn, e.titleAr) ?? e.titleEn, description: (localized(locale, e.descriptionEn, e.descriptionAr) ?? "").slice(0, 160) };
}

export default async function EventPage({ params }: PageProps<"/[lang]/events/[slug]">) {
  const { t, locale } = await getDictionary();
  const { slug } = await params;
  const user = await getCurrentUser();
  const e = await getEvent(slug, user?.role === "admin");
  if (!e) notFound();
  const saved = user ? (await db.select().from(eventSaves).where(and(eq(eventSaves.userId, user.id), eq(eventSaves.eventId, e.id)))).length > 0 : false;
  const catalog = await getCatalog();
  const place = e.placeId ? catalog.byId.get(e.placeId) : null;
  const title = localized(locale, e.titleEn, e.titleAr) ?? e.titleEn;
  const desc = localized(locale, e.descriptionEn, e.descriptionAr);
  const venue = localized(locale, e.venueName, e.venueNameAr) ?? e.venueName;
  const times = localized(locale, e.openingTimes, e.openingTimesAr);
  const cat = EVENT_CATEGORIES.find((c) => c.slug === e.category)?.name[locale] ?? e.category;
  const today = cityToday();
  const past = e.endDate < today;
  const lat = e.lat ?? place?.lat ?? null;
  const lng = e.lng ?? place?.lng ?? null;
  const price = e.isFree
    ? t.events.free
    : e.priceMin != null && e.priceMax != null
      ? formatSarRange(locale, e.priceMin, e.priceMax)
      : e.priceMin != null
        ? `${t.events.from} ${formatSar(locale, e.priceMin)}`
        : t.events.priceNotListed;

  return (
    <article>
      <div className="relative h-64 bg-ink-900 md:h-96">
        {e.image ? (
          <Image src={e.image.url} alt="" fill priority sizes="100vw" className="object-cover opacity-90" />
        ) : (
          <CoverArt seed={e.slug} category="events" initial={e.titleEn} className="absolute inset-0 size-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
        {e.image?.author && (
          <span className="absolute bottom-2 end-3 text-[10px] text-white/70">
            {t.home.photoBy.replace("{author}", e.image.author)} {e.image.license ? `· ${e.image.license}` : ""}
          </span>
        )}
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 md:px-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <header className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-coral-500">
              {cat} · {past ? t.events.past : e.startDate <= today ? t.events.happeningNow : t.events.upcoming}
            </p>
            <h1 className="font-display text-[34px] font-semibold leading-tight md:text-[48px]">{title}</h1>
            <p className="text-sm text-ink-500">{e.origin === "admin" ? t.events.adminManaged : t.events.fromFeed}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {!past && <SaveEventButton eventId={e.id} initial={saved} />}
              {e.ticketUrl && !past && (
                <a href={e.ticketUrl} target="_blank" rel="noreferrer noopener" className={buttonClass("primary")}>
                  <Ticket className="size-[18px]" /> {t.events.buyTickets}
                </a>
              )}
              {!past && (
                <Link href={`/${locale}/plan${place ? `?add=${place.id}` : ""}`} className={buttonClass("secondary")}>
                  {t.events.addToOuting}
                </Link>
              )}
            </div>
          </header>

          {e.changeNote && e.changedAt && (
            <p className="flex items-start gap-2 rounded-2xl bg-gold-400/15 p-4 text-sm text-ink-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-500" />
              {t.events.changedNote.replace("{date}", formatDateTime(locale, e.changedAt)).replace("{note}", e.changeNote)}
            </p>
          )}

          {desc && <p className="max-w-prose whitespace-pre-line text-[17px] leading-relaxed text-ink-800">{desc}</p>}
          <p className="text-xs text-ink-500">{t.events.priceNote}</p>
        </div>

        <aside className="space-y-5">
          <dl className="space-y-4 rounded-3xl bg-white p-5 shadow-card text-[15px]">
            <Row icon={<CalendarDays className="size-4" />} label={t.events.dates}>
              <EventDateRange start={e.startDate} end={e.endDate} locale={locale} />
            </Row>
            <Row icon={<Clock className="size-4" />} label={t.events.times}>
              {times ?? <span className="text-ink-400">{t.events.timesNotProvided}</span>}
            </Row>
            <Row icon={<MapPin className="size-4" />} label={t.events.venue}>
              {place ? (
                <Link href={`/${locale}/place/${place.slug}`} className="text-sea-600 hover:underline">
                  {venue || placeName(locale, place)}
                </Link>
              ) : (
                venue
              )}
            </Row>
            <Row icon={<Ticket className="size-4" />} label={t.events.price}>
              {price}
              {e.priceNote && <span className="block text-sm text-ink-500">{e.priceNote}</span>}
            </Row>
            <Row icon={<Users className="size-4" />} label={t.events.age}>
              {e.ageRestriction ?? <span className="text-ink-400">{t.events.ageNone}</span>}
            </Row>
            {e.officialUrl && (
              <Row icon={<ExternalLink className="size-4" />} label={t.events.officialSite}>
                <a href={e.officialUrl} target="_blank" rel="noreferrer noopener" className="break-all text-sea-600 hover:underline" dir="ltr">
                  {e.officialUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </Row>
            )}
          </dl>
          {lat != null && lng != null && <MiniMap markers={[{ id: e.id, lat, lng, color: "#B84A62", label: venue }]} className="h-52" ariaLabel={t.events.venue} />}
          <div className="space-y-2 rounded-2xl bg-sand-200/60 p-5 text-sm text-ink-600">
            {e.sourceName && (
              <p>
                {t.events.sourceLine.replace("{source}", e.sourceName)}
                {e.sourceUrl && (
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer noopener" className="ms-1 text-sea-600 hover:underline">
                    ↗
                  </a>
                )}
              </p>
            )}
            {e.lastVerifiedAt && <p>{t.events.verifiedOn.replace("{date}", formatDateTime(locale, e.lastVerifiedAt))}</p>}
            <ReportButton targetType="event" targetId={e.id} />
          </div>
        </aside>
      </div>
    </article>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 text-ink-400">{icon}</span>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
