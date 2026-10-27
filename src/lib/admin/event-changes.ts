/**
 * What counts as a significant change to a published event — the kind of
 * change people who saved it need to hear about. Shared by the event form
 * (to ask for a change note) and the API (to notify savers).
 */

export type EventChangeKind = "dates" | "venue" | "times" | "prices";

export type EventFacts = {
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueNameAr: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  openingTimes: string | null;
  openingTimesAr: string | null;
  isFree: boolean | null;
  priceMin: number | null;
  priceMax: number | null;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ");

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function eventChanges(before: EventFacts, after: EventFacts): EventChangeKind[] {
  const out: EventChangeKind[] = [];
  if (before.startDate !== after.startDate || before.endDate !== after.endDate) out.push("dates");
  const moved =
    before.lat != null && before.lng != null && after.lat != null && after.lng != null
      ? km({ lat: before.lat, lng: before.lng }, { lat: after.lat, lng: after.lng }) > 0.3
      : (before.lat == null) !== (after.lat == null);
  if (
    norm(before.venueName) !== norm(after.venueName) ||
    norm(before.venueNameAr) !== norm(after.venueNameAr) ||
    (before.placeId ?? null) !== (after.placeId ?? null) ||
    moved
  )
    out.push("venue");
  if (norm(before.openingTimes) !== norm(after.openingTimes) || norm(before.openingTimesAr) !== norm(after.openingTimesAr)) out.push("times");
  if (!!before.isFree !== !!after.isFree || (before.priceMin ?? null) !== (after.priceMin ?? null) || (before.priceMax ?? null) !== (after.priceMax ?? null))
    out.push("prices");
  return out;
}
