import type { CostBasis } from "./estimates";

/** Compact place record shared by search, the map, carousels and the planner. */
export type PlaceLite = {
  id: string;
  slug: string;
  nameEn: string | null;
  nameAr: string | null;
  category: string;
  secondary: string[];
  sub: string | null;
  lat: number;
  lng: number;
  hood: string | null;
  img: { url: string; w?: number; h?: number; author?: string | null; license?: string | null } | null;
  cost: { min: number | null; max: number | null; planning: number | null; basis: CostBasis };
  /** 0 = free, 1–4 = price level, null = unknown */
  level: number | null;
  attrs: {
    family?: boolean;
    indoor?: boolean;
    outdoor?: boolean;
    free?: boolean;
    groups?: boolean;
    wheelchair?: boolean;
    photo?: boolean;
    romantic?: boolean;
    quiet?: boolean;
  };
  /** Listed opening state at index time (Jeddah time); null when no hours are listed */
  open: "open" | "closed" | "unknown" | null;
  late: boolean;
  hasHours: boolean;
  ver: "unverified" | "verified" | "community";
  pick: boolean;
  gem: boolean;
  chain: boolean;
  brand: string | null;
  /** Average of published JEDDAH LIFE reviews, null when none */
  rating: number | null;
  reviews: number;
  saves: number;
  /** Popularity score from the last 7 days of anonymous views/saves/plans */
  pop: number;
  added: number;
  tags: string[];
  occasions: string[];
  hasDescription: boolean;
};

export type NeighbourhoodLite = {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  center: [number, number];
  featured: boolean;
};
