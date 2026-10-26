import Link from "next/link";
import Image from "next/image";
import type { Event } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { formatDay, formatSar, localized } from "@/lib/i18n/format";
import { CoverArt } from "@/components/place/cover-art";

export function eventPrice(e: Pick<Event, "isFree" | "priceMin" | "priceMax">, locale: Locale, labels: { free: string; from: string; notListed: string }) {
  if (e.isFree) return labels.free;
  if (e.priceMin != null) return `${labels.from} ${formatSar(locale, e.priceMin)}`;
  return labels.notListed;
}

export function EventDateRange({ start, end, locale }: { start: string; end: string; locale: Locale }) {
  if (start === end) return <>{formatDay(locale, start, { weekday: "short" })}</>;
  return (
    <>
      {formatDay(locale, start)} – {formatDay(locale, end, { year: "numeric" })}
    </>
  );
}

export function EventCard({
  e,
  locale,
  labels,
}: {
  e: Event;
  locale: Locale;
  labels: { free: string; from: string; notListed: string; adminManaged: string; fromFeed: string };
}) {
  const title = localized(locale, e.titleEn, e.titleAr) ?? e.titleEn;
  const venue = localized(locale, e.venueName, e.venueNameAr) ?? e.venueName;
  return (
    <article className="group w-[72vw] max-w-[300px] sm:w-[280px]">
      <Link href={`/${locale}/events/${e.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-ink-800 shadow-card">
          {e.image ? (
            <Image src={e.image.url} alt="" fill sizes="300px" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
          ) : (
            <CoverArt seed={e.slug} category="events" className="absolute inset-0 size-full" />
          )}
          <span className="absolute start-2.5 top-2.5 rounded-lg bg-sand-50/95 px-2 py-1 text-[12px] font-semibold text-ink-900">
            <EventDateRange start={e.startDate} end={e.endDate} locale={locale} />
          </span>
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-2 font-display text-[18px] font-semibold leading-snug">{title}</h3>
          <p className="truncate text-[13px] text-ink-500">{venue}</p>
          <p className="text-[13px] text-ink-700">{eventPrice(e, locale, labels)}</p>
          <p className="text-[11px] uppercase tracking-wider text-ink-400">{e.origin === "admin" ? labels.adminManaged : labels.fromFeed}</p>
        </div>
      </Link>
    </article>
  );
}
