import "server-only";
import opening_hours from "opening_hours";
import { CITY_TZ } from "@/lib/i18n/config";

/**
 * Opening hours use the OpenStreetMap opening_hours syntax. The parser
 * works in the process's local time, so we feed it "wall-clock" dates whose
 * local fields equal the current time in Jeddah. That keeps results correct
 * whatever timezone the server runs in.
 */

const NOMINATIM = { lat: 21.5, lon: 39.17, address: { country_code: "sa", state: "" } };
const cache = new Map<string, opening_hours | null>();

function parse(value: string): opening_hours | null {
  if (cache.has(value)) return cache.get(value)!;
  let oh: opening_hours | null = null;
  try {
    oh = new opening_hours(value, NOMINATIM, { mode: 0, tag_key: "opening_hours" } as never);
  } catch {
    oh = null;
  }
  cache.set(value, oh);
  return oh;
}

export function isValidHours(value: string): boolean {
  return parse(value) !== null;
}

/** Wall-clock Date for "now" in Jeddah. */
export function cityWallNow(now = new Date()): Date {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: CITY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return new Date(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
}

/** Wall-clock Date for a planned day (YYYY-MM-DD) and time (HH:MM) in Jeddah. */
export function cityWallAt(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi);
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export type OpenStatus = {
  state: "open" | "closed" | "unknown";
  /** Time of the next change (HH:MM, Jeddah) when it happens within 24 h */
  nextChange: string | null;
  /** Whether the next change is on a later day */
  nextChangeLaterDay: boolean;
};

export function openStatus(value: string | null | undefined, at: Date = cityWallNow()): OpenStatus | null {
  if (!value) return null;
  const oh = parse(value);
  if (!oh) return null;
  const s = oh.getStateString(at, true) as "open" | "closed" | "unknown";
  let next: Date | undefined;
  try {
    next = oh.getNextChange(at, new Date(at.getTime() + 7 * 24 * 3600 * 1000));
  } catch {
    next = undefined;
  }
  const within24 = next && next.getTime() - at.getTime() < 24 * 3600 * 1000;
  return {
    state: s,
    nextChange: next && within24 ? hhmm(next) : null,
    nextChangeLaterDay: !!next && next.getDate() !== at.getDate(),
  };
}

/** Is the place open for the whole window [start, start+minutes]? null when unknown. */
export function openDuring(value: string | null | undefined, start: Date, minutes: number): boolean | null {
  if (!value) return null;
  const oh = parse(value);
  if (!oh) return null;
  const end = new Date(start.getTime() + minutes * 60_000);
  try {
    const intervals = oh.getOpenIntervals(start, end);
    if (!intervals.length) return false;
    // Open at start and stays open (allowing back-to-back intervals).
    let cursor = start.getTime();
    for (const [from, to] of intervals.sort((a, b) => +a[0] - +b[0])) {
      if (+from > cursor + 60_000) return false;
      cursor = Math.max(cursor, +to);
    }
    return cursor >= end.getTime() - 60_000;
  } catch {
    return null;
  }
}

export type DaySchedule = { weekday: number; intervals: Array<[string, string]> };

/** Seven days of open intervals starting today (Jeddah time), for display. */
export function weekSchedule(value: string | null | undefined, from: Date = cityWallNow()): DaySchedule[] | null {
  if (!value) return null;
  const oh = parse(value);
  if (!oh) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const days: DaySchedule[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(start.getTime() + i * 86400000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    let intervals: Array<[string, string]> = [];
    try {
      intervals = oh.getOpenIntervals(dayStart, dayEnd).map(([a, b]) => {
        const end = +b >= +dayEnd ? "24:00" : hhmm(b);
        return [hhmm(a), end];
      });
    } catch {
      intervals = [];
    }
    days.push({ weekday: dayStart.getDay(), intervals });
  }
  return days;
}

/** Listed as open at or after 23:00 on at least one day. */
export function opensLate(value: string | null | undefined): boolean {
  const week = weekSchedule(value);
  if (!week) return false;
  return week.some((d) => d.intervals.some(([, end]) => end === "24:00" || end >= "23:00" || end < "05:00"));
}
