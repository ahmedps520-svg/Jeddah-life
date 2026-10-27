import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, type Event } from "@/lib/db/schema";
import { cityToday } from "@/lib/i18n/format";

export type EventFilters = { when: "any" | "week" | "weekend" | "month"; cat: string | null; area: string | null; free: boolean };

function addDays(day: string, n: number) {
  return new Date(Date.parse(day + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
}

/** [from, to] window (inclusive) for a "when" filter, in Jeddah calendar days. */
export function windowFor(when: EventFilters["when"], today = cityToday()): [string, string] | null {
  const dow = new Date(today + "T12:00:00Z").getUTCDay(); // 0 = Sunday
  switch (when) {
    case "week":
      return [today, addDays(today, 6)];
    case "weekend": {
      // Saudi weekend: Friday and Saturday.
      const toFri = (5 - dow + 7) % 7;
      const start = dow === 6 ? today : addDays(today, toFri);
      return [start, dow === 6 ? today : addDays(start, 1)];
    }
    case "month":
      return [today, addDays(today, 30)];
    default:
      return null;
  }
}

export async function listEvents(f: EventFilters): Promise<Event[]> {
  const today = cityToday();
  const win = windowFor(f.when, today);
  const conds = [eq(events.status, "published"), gte(events.endDate, win ? win[0] : today)];
  if (win) conds.push(lte(events.startDate, win[1]));
  if (f.cat) conds.push(eq(events.category, f.cat));
  if (f.area) conds.push(eq(events.neighbourhood, f.area));
  if (f.free) conds.push(eq(events.isFree, true));
  return db.select().from(events).where(and(...conds)).orderBy(asc(events.startDate)).limit(200);
}

/** Published events overlapping a calendar month (YYYY-MM). */
export async function monthEvents(month: string): Promise<Event[]> {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return db
    .select()
    .from(events)
    .where(and(eq(events.status, "published"), gte(events.endDate, first), lte(events.startDate, last)))
    .orderBy(asc(events.startDate));
}

export async function getEvent(slug: string, includeUnpublished = false): Promise<Event | null> {
  const [e] = await db.select().from(events).where(eq(events.slug, slug));
  if (!e || (e.status !== "published" && !includeUnpublished)) return null;
  return e;
}
