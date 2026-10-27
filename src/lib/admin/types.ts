/**
 * Shapes shared by the admin forms (client) and the admin API (server).
 * Form values are kept as strings where the user types them; the server
 * parses, validates and normalises everything.
 */

export type FieldErrors = Record<string, string>;

export const ATTR_KEYS = [
  "familyFriendly",
  "indoor",
  "outdoor",
  "free",
  "groups",
  "wheelchair",
  "photoSpot",
  "romantic",
  "quiet",
] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];

export type AttrInput = {
  value: boolean | null;
  /** Ticked when the admin confirmed the value; changing a value always counts as confirmed. */
  verified: boolean;
  /** Provenance of the stored value (display only). */
  source?: string;
};

export type ImageInput = {
  url: string;
  width?: number | null;
  height?: number | null;
  alt?: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  origin: string;
};

export const PLACE_STATUSES = ["draft", "published", "archived"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export type PlaceFormValues = {
  nameEn: string;
  nameAr: string;
  category: string;
  secondaryCategories: string[];
  subcategory: string;
  lat: string;
  lng: string;
  neighbourhood: string;
  address: string;
  phone: string;
  website: string;
  instagram: string;
  openingHours: string;
  hoursSource: string;
  priceMin: string;
  priceMax: string;
  priceSource: string;
  priceLevel: string;
  descriptionEn: string;
  descriptionAr: string;
  accessibilityNote: string;
  tags: string[];
  occasions: string[];
  facilities: string[];
  attributes: Partial<Record<AttrKey, AttrInput>>;
  images: ImageInput[];
  sourceDetail: string;
  status: PlaceStatus;
  editorsPick: boolean;
  hiddenGem: boolean;
  hiddenGemNoteEn: string;
  hiddenGemNoteAr: string;
  flaggedOutdated: boolean;
  markVerified: boolean;
};

export type EventFormValues = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: string;
  venueName: string;
  venueNameAr: string;
  placeId: string | null;
  lat: string;
  lng: string;
  startDate: string;
  endDate: string;
  openingTimes: string;
  openingTimesAr: string;
  isFree: boolean;
  priceMin: string;
  priceMax: string;
  priceNote: string;
  ageRestriction: string;
  ticketUrl: string;
  officialUrl: string;
  image: ImageInput | null;
  sourceName: string;
  sourceUrl: string;
  status: PlaceStatus;
  lastVerifiedAt: string;
  changeNote: string;
};

export const HERO_THEMES = ["waterfront", "historic", "entertainment", "food", "weekend", "culture"] as const;
export type HeroTheme = (typeof HERO_THEMES)[number];

export type HeroSlideValues = {
  theme: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  href: string;
  sortOrder: string;
  active: boolean;
  image: ImageInput | null;
};

/** Result of a place lookup used when linking events and submissions. */
export type PlaceHit = {
  id: string;
  slug: string;
  nameEn: string | null;
  nameAr: string | null;
  category: string;
  status: PlaceStatus;
  lat: number;
  lng: number;
  neighbourhood: string | null;
};
