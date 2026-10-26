import { CITY_TZ, intlLocale, type Locale } from "./config";

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const pluralRules = new Map<Locale, Intl.PluralRules>();

/** Pick the right plural form and substitute {n}. */
export function plural(locale: Locale, n: number, forms: PluralForms): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale === "ar" ? "ar" : "en");
    pluralRules.set(locale, rules);
  }
  const form = forms[rules.select(n)] ?? forms.other;
  return form.replace("{n}", formatNumber(locale, n));
}

/** Replace {key} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function formatNumber(locale: Locale, n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), opts).format(n);
}

export function formatSar(locale: Locale, n: number): string {
  const num = formatNumber(locale, Math.round(n));
  return locale === "ar" ? `${num} ر.س` : `${num} SAR`;
}

export function formatSarRange(locale: Locale, min: number, max: number): string {
  if (min === max) return formatSar(locale, min);
  const a = formatNumber(locale, Math.round(min));
  const b = formatNumber(locale, Math.round(max));
  return locale === "ar" ? `${a}–${b} ر.س` : `${a}–${b} SAR`;
}

export function formatDistance(locale: Locale, km: number): string {
  if (km < 1) {
    const m = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return locale === "ar" ? `${formatNumber(locale, m)} م` : `${m} m`;
  }
  const v = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return locale === "ar" ? `${formatNumber(locale, v)} كم` : `${formatNumber(locale, v)} km`;
}

export function formatMinutes(locale: Locale, min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (locale === "ar") {
    if (h && m) return `${formatNumber(locale, h)} س ${formatNumber(locale, m)} د`;
    if (h) return h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${formatNumber(locale, h)} ساعات`;
    return `${formatNumber(locale, m)} دقيقة`;
  }
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** Format a YYYY-MM-DD date (city calendar day). */
export function formatDay(locale: Locale, isoDay: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const [y, mo, d] = isoDay.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: opts.year ?? undefined,
    weekday: opts.weekday,
    ...opts,
  }).format(date);
}

export function formatDateTime(locale: Locale, date: Date | number, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: CITY_TZ,
    dateStyle: "medium",
    ...opts,
  }).format(date);
}

export function formatTime(locale: Locale, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(date);
}

export function relativeTime(locale: Locale, date: Date | number): string {
  const diff = (typeof date === "number" ? date : date.getTime()) - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  if (abs < 365 * day) return rtf.format(Math.round(diff / (30 * day)), "month");
  return rtf.format(Math.round(diff / (365 * day)), "year");
}

/** Today's date in Jeddah as YYYY-MM-DD. */
export function cityToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CITY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

/** Wall-clock parts in Jeddah. */
export function cityNowParts(now = new Date()) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: CITY_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
}

/** Pick the localized name with sensible fallback (proper names are preserved). */
export function placeName(locale: Locale, p: { nameEn: string | null; nameAr: string | null }): string {
  if (locale === "ar") return p.nameAr || p.nameEn || "";
  return p.nameEn || p.nameAr || "";
}

export function localized(locale: Locale, en: string | null | undefined, ar: string | null | undefined): string | null {
  return locale === "ar" ? ar || en || null : en || ar || null;
}
