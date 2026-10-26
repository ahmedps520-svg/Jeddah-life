import type { Attr } from "./parse";
import type { SortKey } from "./engine";

/** URL <-> filter state for Explore, the Map and category pages. */
export type ExploreState = {
  q: string;
  cat: string | null;
  area: string | null;
  max: number | null;
  free: boolean;
  open: boolean;
  rating: number | null;
  dist: number | null;
  attrs: Attr[];
  hideChains: boolean;
  verified: boolean;
  sort: SortKey;
  near: { lat: number; lng: number } | null;
  ignore: string[];
  page: number;
};

const ATTRS: Attr[] = ["family", "indoor", "outdoor", "groups", "photo", "romantic", "quiet", "wheelchair", "late"];
const SORTS: SortKey[] = ["relevance", "distance", "price", "rating", "popularity"];

type SP = Record<string, string | string[] | undefined> | URLSearchParams;

function get(sp: SP, k: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined;
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
}

export function parseExploreParams(sp: SP): ExploreState {
  const num = (k: string) => {
    const v = Number(get(sp, k));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const near = get(sp, "near")?.split(",").map(Number);
  const sort = get(sp, "sort") as SortKey | undefined;
  return {
    q: (get(sp, "q") ?? "").slice(0, 160),
    cat: get(sp, "cat") || null,
    area: get(sp, "area") || null,
    max: num("max"),
    free: get(sp, "free") === "1",
    open: get(sp, "open") === "1",
    rating: num("rating"),
    dist: num("dist"),
    attrs: (get(sp, "attrs") ?? "").split(",").filter((a): a is Attr => ATTRS.includes(a as Attr)),
    hideChains: get(sp, "chains") === "0",
    verified: get(sp, "verified") === "1",
    sort: sort && SORTS.includes(sort) ? sort : "relevance",
    near:
      near && near.length === 2 && near.every(Number.isFinite) && near[0] > 21 && near[0] < 22.3 && near[1] > 38.8 && near[1] < 39.6
        ? { lat: near[0], lng: near[1] }
        : null,
    ignore: (get(sp, "ignore") ?? "").split(",").filter(Boolean),
    page: Math.max(1, Math.min(50, Number(get(sp, "page")) || 1)),
  };
}

export function toSearchParams(s: Partial<ExploreState>): URLSearchParams {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.cat) p.set("cat", s.cat);
  if (s.area) p.set("area", s.area);
  if (s.max) p.set("max", String(s.max));
  if (s.free) p.set("free", "1");
  if (s.open) p.set("open", "1");
  if (s.rating) p.set("rating", String(s.rating));
  if (s.dist) p.set("dist", String(s.dist));
  if (s.attrs?.length) p.set("attrs", s.attrs.join(","));
  if (s.hideChains) p.set("chains", "0");
  if (s.verified) p.set("verified", "1");
  if (s.sort && s.sort !== "relevance") p.set("sort", s.sort);
  if (s.near) p.set("near", `${s.near.lat.toFixed(4)},${s.near.lng.toFixed(4)}`);
  if (s.ignore?.length) p.set("ignore", s.ignore.join(","));
  if (s.page && s.page > 1) p.set("page", String(s.page));
  return p;
}

export function activeFilterCount(s: ExploreState): number {
  return (
    (s.area ? 1 : 0) +
    (s.max ? 1 : 0) +
    (s.free ? 1 : 0) +
    (s.open ? 1 : 0) +
    (s.rating ? 1 : 0) +
    (s.dist ? 1 : 0) +
    s.attrs.length +
    (s.hideChains ? 1 : 0) +
    (s.verified ? 1 : 0)
  );
}
