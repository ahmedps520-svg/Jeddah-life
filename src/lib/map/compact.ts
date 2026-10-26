import type { PlaceLite } from "@/lib/places/types";

/** Compact tuple encoding for sending every place to the map in one request. */
export type MapPlace = {
  id: string;
  slug: string;
  en: string | null;
  ar: string | null;
  cat: string;
  sec: string[];
  sub: string | null;
  lat: number;
  lng: number;
  hood: string | null;
  img: string | null;
  min: number | null;
  max: number | null;
  plan: number | null;
  basis: PlaceLite["cost"]["basis"];
  open: PlaceLite["open"];
  rating: number | null;
  reviews: number;
  flags: number;
};

export const FLAG = {
  family: 1,
  indoor: 2,
  outdoor: 4,
  free: 8,
  groups: 16,
  wheelchair: 32,
  photo: 64,
  late: 128,
  verified: 256,
  chain: 512,
  pick: 1024,
  gem: 2048,
} as const;

export function toMapPlace(p: PlaceLite): MapPlace {
  let flags = 0;
  if (p.attrs.family) flags |= FLAG.family;
  if (p.attrs.indoor) flags |= FLAG.indoor;
  if (p.attrs.outdoor) flags |= FLAG.outdoor;
  if (p.attrs.free || p.cost.basis === "free") flags |= FLAG.free;
  if (p.attrs.groups) flags |= FLAG.groups;
  if (p.attrs.wheelchair) flags |= FLAG.wheelchair;
  if (p.attrs.photo) flags |= FLAG.photo;
  if (p.late) flags |= FLAG.late;
  if (p.ver === "verified") flags |= FLAG.verified;
  if (p.chain) flags |= FLAG.chain;
  if (p.pick) flags |= FLAG.pick;
  if (p.gem) flags |= FLAG.gem;
  return {
    id: p.id,
    slug: p.slug,
    en: p.nameEn,
    ar: p.nameAr,
    cat: p.category,
    sec: p.secondary,
    sub: p.sub,
    lat: p.lat,
    lng: p.lng,
    hood: p.hood,
    img: p.img?.url ?? null,
    min: p.cost.min,
    max: p.cost.max,
    plan: p.cost.planning,
    basis: p.cost.basis,
    open: p.open,
    rating: p.rating,
    reviews: p.reviews,
    flags,
  };
}
