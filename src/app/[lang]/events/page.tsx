import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { listEvents, monthEvents, type EventFilters } from "@/lib/events";
import { EventCard } from "@/components/events/event-card";
import { EVENT_CATEGORIES } from "@/lib/taxonomy";
import { cityToday, localized, plural } from "@/lib/i18n/format";
import { intlLocale } from "@/lib/i18n/config";
import { getCatalog } from "@/lib/places/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.events.title, description: t.events.lede };
}

const WHEN = ["any", "week", "weekend", "month"] as const;

export default async function EventsPage({ searchParams }: PageProps<"/[lang]/events">) {
  const { t, locale } = await getDictionary();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const view = str("view") === "calendar" ? "calendar" : "list";
  const filters: EventFilters = {
    when: WHEN.includes(str("when") as (typeof WHEN)[number]) ? (str("when") as EventFilters["when"]) : "any",
    cat: EVENT_CATEGORIES.some((c) => c.slug === str("cat")) ? str("cat") : null,
    area: str("area") || null,
    free: str("free") === "1",
  };
  const month = /^\d{4}-\d{2}$/.test(str("month")) ? str("month") : cityToday().slice(0, 7);
  const catalog = await getCatalog();
  const labels = { free: t.events.free, from: t.events.from, notListed: t.events.priceNotListed, adminManaged: t.events.adminManaged, fromFeed: t.events.fromFeed };

  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = {
      view: view === "calendar" ? "calendar" : null,
      when: filters.when === "any" ? null : filters.when,
      cat: filters.cat,
      area: filters.area,
      free: filters.free ? "1" : null,
      month: view === "calendar" ? month : null,
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return `/${locale}/events${s ? `?${s}` : ""}`;
  };

  const whenLabel = { any: t.events.anyDate, week: t.events.thisWeek, weekend: t.events.weekend, month: t.events.thisMonth };
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${active ? "bg-ink-900 text-white" : "bg-white ring-1 ring-sand-200 hover:ring-ink-300"}`;
  const eventHoods = catalog.hoods.filter((h) => h.featured);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="max-w-3xl">
        <h1 className="font-display text-[38px] font-semibold leading-tight md:text-[48px]">{t.events.title}</h1>
        <p className="mt-3 text-lg text-ink-600">{t.events.lede}</p>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-sand-200/70 p-1">
          <Link href={qs({ view: null, month: null })} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${view === "list" ? "bg-white shadow-card" : "text-ink-600"}`}>
            <List className="size-4" /> {t.events.list}
          </Link>
          <Link href={qs({ view: "calendar", month })} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${view === "calendar" ? "bg-white shadow-card" : "text-ink-600"}`}>
            <CalendarDays className="size-4" /> {t.events.calendar}
          </Link>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {view === "list" && (
          <div className="rail -mx-4 gap-2 px-4 md:mx-0 md:flex md:flex-wrap md:px-0" role="group" aria-label={t.events.when}>
            {WHEN.map((w) => (
              <Link key={w} href={qs({ when: w === "any" ? null : w })} className={chip(filters.when === w)} aria-current={filters.when === w ? "true" : undefined}>
                {whenLabel[w]}
              </Link>
            ))}
            <Link href={qs({ free: filters.free ? null : "1" })} className={chip(filters.free)}>
              {t.events.freeOnly}
            </Link>
          </div>
        )}
        <div className="rail -mx-4 gap-2 px-4 md:mx-0 md:flex md:flex-wrap md:px-0" role="group" aria-label={t.events.category}>
          <Link href={qs({ cat: null })} className={chip(!filters.cat)}>
            {t.explore.allCategories}
          </Link>
          {EVENT_CATEGORIES.map((c) => (
            <Link key={c.slug} href={qs({ cat: filters.cat === c.slug ? null : c.slug })} className={chip(filters.cat === c.slug)}>
              {c.name[locale]}
            </Link>
          ))}
        </div>
        {eventHoods.length > 0 && view === "list" && (
          <form action={`/${locale}/events`} className="flex items-center gap-2">
            {filters.cat && <input type="hidden" name="cat" value={filters.cat} />}
            {filters.when !== "any" && <input type="hidden" name="when" value={filters.when} />}
            {filters.free && <input type="hidden" name="free" value="1" />}
            <label className="text-sm text-ink-600" htmlFor="ev-area">
              {t.events.area}
            </label>
            <select id="ev-area" name="area" defaultValue={filters.area ?? ""} className="h-10 rounded-full border border-sand-300 bg-white px-3 text-sm">
              <option value="">{t.explore.anyArea}</option>
              {eventHoods.map((h) => (
                <option key={h.slug} value={h.slug}>
                  {locale === "ar" ? h.nameAr || h.nameEn : h.nameEn}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-full bg-white px-4 text-sm ring-1 ring-sand-300">
              {t.common.apply}
            </button>
          </form>
        )}
      </div>

      {view === "list" ? (
        <EventList filters={filters} />
      ) : (
        <Calendar month={month} />
      )}
    </div>
  );

  async function EventList({ filters }: { filters: EventFilters }) {
    const list = await listEvents(filters);
    if (!list.length) {
      return (
        <div className="mt-10 rounded-3xl bg-white p-8 text-center shadow-card">
          <CalendarDays className="mx-auto size-10 text-ink-300" />
          <p className="mt-4 font-display text-xl">{t.events.empty}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-500">{t.events.emptyHonest}</p>
        </div>
      );
    }
    return (
      <>
        <p className="mt-6 text-sm text-ink-600">{plural(locale, list.length, t.events.eventsCount)}</p>
        <ul className="mt-4 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <li key={e.id} className="[&>article]:w-full [&>article]:max-w-none">
              <EventCard e={e} locale={locale} labels={labels} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  async function Calendar({ month }: { month: string }) {
    const list = await monthEvents(month);
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = first.getUTCDay();
    const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
    const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    const monthName = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
    const weekdays = Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + i))),
    );
    const today = cityToday();
    const Prev = locale === "ar" ? ChevronRight : ChevronLeft;
    const Next = locale === "ar" ? ChevronLeft : ChevronRight;
    const cells: Array<{ day: number; iso: string } | null> = [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: days }, (_, i) => ({ day: i + 1, iso: `${month}-${String(i + 1).padStart(2, "0")}` })),
    ];
    return (
      <section className="mt-8" aria-label={monthName}>
        <div className="mb-4 flex items-center justify-between">
          <Link href={qs({ view: "calendar", month: prev })} className="rounded-full p-2 hover:bg-sand-200" aria-label={t.events.monthPrev}>
            <Prev className="size-5" />
          </Link>
          <h2 className="font-display text-2xl font-semibold">{monthName}</h2>
          <Link href={qs({ view: "calendar", month: next })} className="rounded-full p-2 hover:bg-sand-200" aria-label={t.events.monthNext}>
            <Next className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-500">
          {weekdays.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={`e${i}`} />;
            const dayEvents = list.filter((e) => e.startDate <= c.iso && e.endDate >= c.iso);
            return (
              <div
                key={c.iso}
                className={`min-h-20 rounded-xl p-1.5 text-start md:min-h-28 ${c.iso === today ? "bg-sea-50 ring-1 ring-sea-200" : "bg-white"} ${c.iso < today ? "opacity-60" : ""}`}
              >
                <div className="text-xs font-semibold tabular-nums">{new Intl.NumberFormat(intlLocale(locale)).format(c.day)}</div>
                <ul className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <Link href={`/${locale}/events/${e.slug}`} className="block truncate rounded bg-coral-400/20 px-1 text-[10px] leading-4 text-ink-800 hover:bg-coral-400/40 md:text-[11px]">
                        {localized(locale, e.titleEn, e.titleAr)}
                      </Link>
                    </li>
                  ))}
                  {dayEvents.length > 3 && <li className="text-[10px] text-ink-500">+{dayEvents.length - 3}</li>}
                </ul>
              </div>
            );
          })}
        </div>
        {list.length === 0 && <p className="mt-6 text-center text-sm text-ink-500">{t.events.emptyHonest}</p>}
      </section>
    );
  }
}
