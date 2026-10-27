import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, eventSaves, places, type Event } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { EVENT_CATEGORIES } from "@/lib/taxonomy";
import { cityToday } from "@/lib/i18n/format";
import { FieldError, zodFields } from "./api";
import { checkCoords, checkImages, ImageShape, imageToInput, nearestHood } from "./places";
import { eventChanges, type EventChangeKind, type EventFacts } from "./event-changes";
import { PLACE_STATUSES, type EventFormValues, type FieldErrors } from "./types";
import { isHttpsUrl, isIsoDay, parseWhole } from "./validate";

const s = (max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v == null ? "" : String(v).trim()))
    .pipe(z.string().max(max, "too_long"));

const EventShape = z.object({
  titleEn: s(200),
  titleAr: s(200),
  descriptionEn: s(5000),
  descriptionAr: s(5000),
  category: s(40),
  venueName: s(200),
  venueNameAr: s(200),
  placeId: z.string().max(64).nullable().optional(),
  lat: s(30),
  lng: s(30),
  startDate: s(10),
  endDate: s(10),
  openingTimes: s(300),
  openingTimesAr: s(300),
  isFree: z.boolean().default(false),
  priceMin: s(12),
  priceMax: s(12),
  priceNote: s(300),
  ageRestriction: s(80),
  ticketUrl: s(500),
  officialUrl: s(500),
  image: ImageShape.nullable().optional(),
  sourceName: s(200),
  sourceUrl: s(500),
  status: z.enum(PLACE_STATUSES),
  lastVerifiedAt: s(10),
  changeNote: s(300),
});

const EVENT_CATEGORY_SLUGS = new Set<string>(EVENT_CATEGORIES.map((c) => c.slug));

export type EventValues = Omit<typeof events.$inferInsert, "id" | "slug" | "origin" | "createdAt" | "changeNote" | "changedAt">;

export function eventFacts(e: Pick<Event, keyof EventFacts>): EventFacts {
  return {
    startDate: e.startDate,
    endDate: e.endDate,
    venueName: e.venueName,
    venueNameAr: e.venueNameAr,
    placeId: e.placeId,
    lat: e.lat,
    lng: e.lng,
    openingTimes: e.openingTimes,
    openingTimesAr: e.openingTimesAr,
    isFree: e.isFree,
    priceMin: e.priceMin,
    priceMax: e.priceMax,
  };
}

/**
 * Validates an event from the admin form. When a published event's dates,
 * venue, times or prices change, a change note is required and returned with
 * the kinds of change so savers can be notified.
 */
export async function validateEvent(
  raw: unknown,
  existing?: Event | null,
): Promise<{ values: EventValues; changes: EventChangeKind[]; changeNote: string | null }> {
  const parsed = EventShape.safeParse(raw);
  if (!parsed.success) throw new FieldError(zodFields(parsed.error));
  const d = parsed.data;
  const e: FieldErrors = {};

  if (!d.titleEn) e.titleEn = "title_required";
  if (!d.titleAr) e.titleAr = "title_required";
  if (!d.descriptionEn && !d.descriptionAr) e.descriptionEn = "description_required";
  if (!EVENT_CATEGORY_SLUGS.has(d.category)) e.category = d.category ? "category" : "required";
  if (!d.venueName) e.venueName = "required";

  let place: { id: string; lat: number; lng: number; neighbourhood: string | null } | null = null;
  if (d.placeId) {
    const [p] = await db
      .select({ id: places.id, lat: places.lat, lng: places.lng, neighbourhood: places.neighbourhood })
      .from(places)
      .where(eq(places.id, d.placeId));
    if (!p) e.placeId = "place_not_found";
    place = p ?? null;
  }

  let lat: number | null = null;
  let lng: number | null = null;
  if (!d.lat && !d.lng && place) {
    lat = place.lat;
    lng = place.lng;
  } else if (!d.lat && !d.lng) {
    e.lat = "coords_required";
  } else {
    const c = checkCoords(d.lat, d.lng, e);
    lat = c.lat;
    lng = c.lng;
  }

  if (!isIsoDay(d.startDate)) e.startDate = d.startDate ? "date" : "required";
  if (!isIsoDay(d.endDate)) e.endDate = d.endDate ? "date" : "required";
  if (!e.startDate && !e.endDate && d.endDate < d.startDate) e.endDate = "date_order";

  const priceMin = parseWhole(d.priceMin);
  const priceMax = parseWhole(d.priceMax);
  if (Number.isNaN(priceMin) || (priceMin ?? 0) > 100_000) e.priceMin = "price_value";
  if (Number.isNaN(priceMax) || (priceMax ?? 0) > 100_000) e.priceMax = "price_value";
  if (d.isFree && ((priceMin ?? 0) > 0 || (priceMax ?? 0) > 0)) e.priceMin = "free_price";
  if (priceMin != null && priceMax != null && !Number.isNaN(priceMin) && !Number.isNaN(priceMax) && priceMin > priceMax) e.priceMax = "price_order";

  if (d.ticketUrl && !isHttpsUrl(d.ticketUrl)) e.ticketUrl = "https";
  if (d.officialUrl && !isHttpsUrl(d.officialUrl)) e.officialUrl = "https";
  if (!d.sourceName) e.sourceName = "source_required";
  if (!d.sourceUrl) e.sourceUrl = "source_required";
  else if (!isHttpsUrl(d.sourceUrl)) e.sourceUrl = "https";

  const [image] = d.image ? checkImages([d.image], e, "image") : [null];
  // checkImages keys errors as image.0.field; the event form has a single image.
  for (const k of Object.keys(e)) {
    if (k.startsWith("image.0.")) {
      e[k.replace("image.0.", "image.")] = e[k];
      delete e[k];
    }
  }

  let lastVerifiedAt: Date | null = null;
  if (d.lastVerifiedAt) {
    if (!isIsoDay(d.lastVerifiedAt)) e.lastVerifiedAt = "date";
    else if (d.lastVerifiedAt > cityToday()) e.lastVerifiedAt = "date_future";
    else lastVerifiedAt = new Date(`${d.lastVerifiedAt}T12:00:00+03:00`);
  }

  const values: EventValues = {
    titleEn: d.titleEn,
    titleAr: d.titleAr || null,
    descriptionEn: d.descriptionEn || null,
    descriptionAr: d.descriptionAr || null,
    category: d.category,
    venueName: d.venueName,
    venueNameAr: d.venueNameAr || null,
    placeId: place?.id ?? null,
    lat,
    lng,
    neighbourhood: null,
    startDate: d.startDate,
    endDate: d.endDate,
    openingTimes: d.openingTimes || null,
    openingTimesAr: d.openingTimesAr || null,
    priceMin: d.isFree ? null : priceMin,
    priceMax: d.isFree ? null : priceMax,
    priceNote: d.priceNote || null,
    isFree: d.isFree,
    ageRestriction: d.ageRestriction || null,
    ticketUrl: d.ticketUrl || null,
    officialUrl: d.officialUrl || null,
    image,
    sourceName: d.sourceName,
    sourceUrl: d.sourceUrl,
    status: d.status,
    lastVerifiedAt,
    updatedAt: new Date(),
  };

  const changes =
    existing && existing.status === "published" && d.status === "published"
      ? eventChanges(eventFacts(existing), eventFacts(values as Event))
      : [];
  if (changes.length && !d.changeNote) e.changeNote = "change_note";

  if (Object.keys(e).length) throw new FieldError(e);

  values.neighbourhood = place?.neighbourhood ?? (lat != null && lng != null ? await nearestHood(lat, lng) : null);
  return { values, changes, changeNote: changes.length ? d.changeNote : null };
}

/** Notifies everyone who saved the event about a significant change. Returns how many were notified. */
export async function notifyEventSavers(event: Pick<Event, "id" | "slug" | "titleEn" | "titleAr">, changes: EventChangeKind[], note: string, at: Date) {
  const savers = await db.select({ userId: eventSaves.userId }).from(eventSaves).where(eq(eventSaves.eventId, event.id));
  for (const s of savers) {
    await notify(
      s.userId,
      "event_changed",
      { eventId: event.id, slug: event.slug, titleEn: event.titleEn, titleAr: event.titleAr, note, changes: changes.join(",") },
      `event_changed:${event.id}:${at.getTime()}:${s.userId}`,
    );
  }
  if (savers.length) await db.update(eventSaves).set({ notifiedChangeAt: at }).where(eq(eventSaves.eventId, event.id));
  return savers.length;
}

export function eventToForm(e: Event): EventFormValues {
  const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  return {
    titleEn: e.titleEn,
    titleAr: str(e.titleAr),
    descriptionEn: str(e.descriptionEn),
    descriptionAr: str(e.descriptionAr),
    category: e.category,
    venueName: e.venueName,
    venueNameAr: str(e.venueNameAr),
    placeId: e.placeId,
    lat: str(e.lat),
    lng: str(e.lng),
    startDate: e.startDate,
    endDate: e.endDate,
    openingTimes: str(e.openingTimes),
    openingTimesAr: str(e.openingTimesAr),
    isFree: !!e.isFree,
    priceMin: str(e.priceMin),
    priceMax: str(e.priceMax),
    priceNote: str(e.priceNote),
    ageRestriction: str(e.ageRestriction),
    ticketUrl: str(e.ticketUrl),
    officialUrl: str(e.officialUrl),
    image: e.image ? imageToInput(e.image) : null,
    sourceName: str(e.sourceName),
    sourceUrl: str(e.sourceUrl),
    status: e.status,
    lastVerifiedAt: e.lastVerifiedAt ? cityToday(e.lastVerifiedAt) : "",
    changeNote: "",
  };
}

export function emptyEventForm(): EventFormValues {
  return {
    titleEn: "",
    titleAr: "",
    descriptionEn: "",
    descriptionAr: "",
    category: "",
    venueName: "",
    venueNameAr: "",
    placeId: null,
    lat: "",
    lng: "",
    startDate: "",
    endDate: "",
    openingTimes: "",
    openingTimesAr: "",
    isFree: false,
    priceMin: "",
    priceMax: "",
    priceNote: "",
    ageRestriction: "",
    ticketUrl: "",
    officialUrl: "",
    image: null,
    sourceName: "",
    sourceUrl: "",
    status: "draft",
    lastVerifiedAt: cityToday(),
    changeNote: "",
  };
}
