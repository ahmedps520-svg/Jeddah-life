import "server-only";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, neighbourhoods, places, type ImageCredit, type Place, type PlaceAttributes } from "@/lib/db/schema";
import { isValidHours } from "@/lib/places/hours";
import { haversineKm } from "@/lib/places/estimates";
import { FACILITIES, OCCASIONS, PLACE_CATEGORIES, SUBCATEGORIES } from "@/lib/taxonomy";
import { FieldError, zodFields } from "./api";
import {
  ATTR_KEYS,
  PLACE_STATUSES,
  type AttrInput,
  type FieldErrors,
  type ImageInput,
  type PlaceFormValues,
  type PlaceHit,
} from "./types";
import {
  JEDDAH_LAT,
  JEDDAH_LNG,
  isHttpsUrl,
  normalizeInstagram,
  normalizeSaudiPhone,
  parseCoord,
  parseWhole,
  slugify,
} from "./validate";

/* ------------------------------------------------------------------ */
/* Shapes                                                               */
/* ------------------------------------------------------------------ */

const s = (max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v == null ? "" : String(v).trim()))
    .pipe(z.string().max(max, "too_long"));

export const ImageShape = z.object({
  url: z.string().trim().min(1, "required").max(600),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  alt: s(200),
  author: s(200),
  license: s(120),
  licenseUrl: s(500),
  sourceUrl: s(500),
  origin: s(20),
});

const AttrShape = z.object({ value: z.boolean().nullable(), verified: z.boolean() });

const PlaceShape = z.object({
  nameEn: s(160),
  nameAr: s(160),
  category: s(40),
  secondaryCategories: z.array(z.string().max(40)).max(6).default([]),
  subcategory: s(80),
  lat: s(30),
  lng: s(30),
  neighbourhood: s(120),
  address: s(300),
  phone: s(40),
  website: s(500),
  instagram: s(200),
  openingHours: s(500),
  hoursSource: s(200),
  priceMin: s(12),
  priceMax: s(12),
  priceSource: s(300),
  priceLevel: s(2),
  descriptionEn: s(5000),
  descriptionAr: s(5000),
  accessibilityNote: s(500),
  tags: z.array(z.string().trim().max(40, "too_long")).max(25).default([]),
  occasions: z.array(z.string().max(40)).max(12).default([]),
  facilities: z.array(z.string().max(40)).max(30).default([]),
  attributes: z.record(z.string(), AttrShape).default({}),
  images: z.array(ImageShape).max(12, "too_long").default([]),
  sourceDetail: s(500),
  status: z.enum(PLACE_STATUSES),
  editorsPick: z.boolean().default(false),
  hiddenGem: z.boolean().default(false),
  hiddenGemNoteEn: s(600),
  hiddenGemNoteAr: s(600),
  flaggedOutdated: z.boolean().default(false),
  markVerified: z.boolean().default(false),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const CATEGORY_SLUGS = new Set<string>(PLACE_CATEGORIES.map((c) => c.slug));
const OCCASION_SLUGS = new Set<string>(OCCASIONS.map((o) => o.slug));
const FACILITY_KEYS = new Set(Object.keys(FACILITIES));

type Hood = { slug: string; centerLat: number; centerLng: number };
let hoodCache: { at: number; hoods: Hood[] } | null = null;

export async function allHoods(): Promise<Hood[]> {
  if (hoodCache && Date.now() - hoodCache.at < 10 * 60_000) return hoodCache.hoods;
  const hoods = await db
    .select({ slug: neighbourhoods.slug, centerLat: neighbourhoods.centerLat, centerLng: neighbourhoods.centerLng })
    .from(neighbourhoods);
  hoodCache = { at: Date.now(), hoods };
  return hoods;
}

/** Neighbourhood whose centre is closest to the point. */
export async function nearestHood(lat: number, lng: number): Promise<string | null> {
  let best: { slug: string; d: number } | null = null;
  for (const h of await allHoods()) {
    const d = haversineKm({ lat, lng }, { lat: h.centerLat, lng: h.centerLng });
    if (!best || d < best.d) best = { slug: h.slug, d };
  }
  return best?.slug ?? null;
}

/** Validates a coordinate pair typed by an admin; records errors under the given keys. */
export function checkCoords(lat: string, lng: string, errors: FieldErrors, keys = { lat: "lat", lng: "lng" }) {
  const la = parseCoord(lat);
  const ln = parseCoord(lng);
  if (la == null) errors[keys.lat] = "required";
  else if (Number.isNaN(la)) errors[keys.lat] = "invalid";
  else if (la < JEDDAH_LAT[0] || la > JEDDAH_LAT[1]) errors[keys.lat] = "lat_range";
  if (ln == null) errors[keys.lng] = "required";
  else if (Number.isNaN(ln)) errors[keys.lng] = "invalid";
  else if (ln < JEDDAH_LNG[0] || ln > JEDDAH_LNG[1]) errors[keys.lng] = "lng_range";
  return { lat: la ?? Number.NaN, lng: ln ?? Number.NaN };
}

/**
 * Image URLs must be servable by next/image: local uploads and prepared
 * images, or Wikimedia Commons (the only remote host configured).
 */
export function isAllowedImageUrl(url: string): boolean {
  if (/^\/(uploads|images)\/(?!.*\.\.)[A-Za-z0-9/_.-]+$/.test(url)) return true;
  return url.startsWith("https://upload.wikimedia.org/wikipedia/commons/") && isHttpsUrl(url);
}

/** Validates image credits and URLs; returns stored ImageCredit records. */
export function checkImages(images: z.infer<typeof ImageShape>[], errors: FieldErrors, prefix: string): ImageCredit[] {
  return images.map((img, i) => {
    const k = `${prefix}.${i}`;
    if (!isAllowedImageUrl(img.url)) errors[`${k}.url`] = "image_url";
    if (!img.author) errors[`${k}.author`] = "image_credit";
    if (!img.license) errors[`${k}.license`] = "image_credit";
    if (img.licenseUrl && !isHttpsUrl(img.licenseUrl)) errors[`${k}.licenseUrl`] = "https";
    if (img.sourceUrl && !isHttpsUrl(img.sourceUrl)) errors[`${k}.sourceUrl`] = "https";
    const uploaded = img.url.startsWith("/uploads/");
    return {
      url: img.url,
      width: img.width ?? undefined,
      height: img.height ?? undefined,
      alt: img.alt || undefined,
      author: img.author || null,
      license: img.license || null,
      licenseUrl: img.licenseUrl || null,
      sourceUrl: img.sourceUrl || null,
      origin: ["commons", "upload", "official"].includes(img.origin) ? img.origin : uploaded ? "upload" : "commons",
    };
  });
}

export function imageToInput(img: ImageCredit): ImageInput {
  return {
    url: img.url,
    width: img.width ?? null,
    height: img.height ?? null,
    alt: img.alt ?? "",
    author: img.author ?? "",
    license: img.license ?? "",
    licenseUrl: img.licenseUrl ?? "",
    sourceUrl: img.sourceUrl ?? "",
    origin: img.origin,
  };
}

/** Unique slug for a new record, derived from its English name. */
export async function uniqueSlug(table: "places" | "events", base: string, fallbackPrefix: string): Promise<string> {
  const root = slugify(base) || `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const exists =
      table === "places"
        ? await db.select({ id: places.id }).from(places).where(eq(places.slug, candidate)).limit(1)
        : await db.select({ id: events.id }).from(events).where(eq(events.slug, candidate)).limit(1);
    if (!exists.length) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

export type PlaceValues = Omit<
  typeof places.$inferInsert,
  "id" | "slug" | "source" | "sourceRef" | "createdAt" | "brand" | "isChain"
>;

function mergeAttributes(input: Record<string, AttrInput>, prev: PlaceAttributes | undefined): PlaceAttributes {
  const out: PlaceAttributes = {};
  for (const key of ATTR_KEYS) {
    const a = input[key];
    const old = prev?.[key];
    if (!a || a.value === null) continue;
    if (!a.verified && old && old.value === a.value) out[key] = old;
    else out[key] = { value: a.value, source: "verified" };
  }
  return out;
}

/**
 * Validates and normalises a place submitted from the admin form.
 * Throws FieldError with every problem found, so the form can show them all at once.
 */
export async function validatePlace(raw: unknown, existing?: Place | null): Promise<{ values: PlaceValues; markVerified: boolean }> {
  const parsed = PlaceShape.safeParse(raw);
  if (!parsed.success) throw new FieldError(zodFields(parsed.error));
  const d = parsed.data;
  const e: FieldErrors = {};

  if (!d.nameEn && !d.nameAr) e.nameEn = "name_required";
  if (!CATEGORY_SLUGS.has(d.category)) e.category = d.category ? "category" : "required";
  const secondary = [...new Set(d.secondaryCategories)].filter((c) => c !== d.category);
  if (secondary.some((c) => !CATEGORY_SLUGS.has(c))) e.secondaryCategories = "category";
  if (d.subcategory && !SUBCATEGORIES[d.subcategory] && d.subcategory !== existing?.subcategory) e.subcategory = "subcategory";

  const { lat, lng } = checkCoords(d.lat, d.lng, e);

  let neighbourhood: string | null = d.neighbourhood || null;
  if (neighbourhood && !(await allHoods()).some((h) => h.slug === neighbourhood)) e.neighbourhood = "neighbourhood";

  const phone = d.phone ? normalizeSaudiPhone(d.phone) : null;
  if (d.phone && !phone) e.phone = "phone";
  if (d.website && !isHttpsUrl(d.website)) e.website = "https";
  const instagram = d.instagram ? normalizeInstagram(d.instagram) : null;
  if (d.instagram && !instagram) e.instagram = "instagram";

  if (d.openingHours && !isValidHours(d.openingHours)) e.openingHours = "hours";
  if (d.openingHours && !d.hoursSource) e.hoursSource = "hours_source";

  const priceMin = parseWhole(d.priceMin);
  const priceMax = parseWhole(d.priceMax);
  if (Number.isNaN(priceMin) || (priceMin ?? 0) > 100_000) e.priceMin = "price_value";
  if (Number.isNaN(priceMax) || (priceMax ?? 0) > 100_000) e.priceMax = "price_value";
  if (priceMin != null && priceMax != null && !Number.isNaN(priceMin) && !Number.isNaN(priceMax) && priceMin > priceMax) e.priceMax = "price_order";
  if ((priceMin != null || priceMax != null) && !d.priceSource) e.priceSource = "price_source";
  const priceLevel = parseWhole(d.priceLevel);
  if (priceLevel != null && (Number.isNaN(priceLevel) || priceLevel < 1 || priceLevel > 4)) e.priceLevel = "invalid";

  if (d.occasions.some((o) => !OCCASION_SLUGS.has(o))) e.occasions = "invalid";
  if (d.facilities.some((f) => !FACILITY_KEYS.has(f))) e.facilities = "invalid";
  const tags: string[] = [];
  for (const tag of d.tags) if (tag && !tags.some((x) => x.toLowerCase() === tag.toLowerCase())) tags.push(tag);

  const images = checkImages(d.images, e, "images");

  if (d.hiddenGem && !d.hiddenGemNoteEn && !d.hiddenGemNoteAr) e.hiddenGemNoteEn = "gem_note";

  if (Object.keys(e).length) throw new FieldError(e);

  if (!neighbourhood) neighbourhood = await nearestHood(lat, lng);

  const now = new Date();
  const openingHours = d.openingHours || null;
  const hoursChanged = openingHours !== (existing?.openingHours ?? null) || (d.hoursSource || null) !== (existing?.hoursSource ?? null);
  const priceChanged =
    priceMin !== (existing?.priceMin ?? null) || priceMax !== (existing?.priceMax ?? null) || (d.priceSource || null) !== (existing?.priceSource ?? null);

  const values: PlaceValues = {
    nameEn: d.nameEn || null,
    nameAr: d.nameAr || null,
    category: d.category,
    secondaryCategories: secondary,
    subcategory: d.subcategory || null,
    tags,
    occasions: [...new Set(d.occasions)],
    descriptionEn: d.descriptionEn || null,
    descriptionAr: d.descriptionAr || null,
    lat,
    lng,
    neighbourhood,
    address: d.address || null,
    phone,
    website: d.website || null,
    instagram,
    openingHours,
    hoursSource: openingHours ? d.hoursSource : null,
    hoursCheckedAt: openingHours ? (hoursChanged ? now : (existing?.hoursCheckedAt ?? now)) : null,
    priceMin,
    priceMax,
    priceSource: priceMin != null || priceMax != null ? d.priceSource : null,
    priceCheckedAt: priceMin != null || priceMax != null ? (priceChanged ? now : (existing?.priceCheckedAt ?? now)) : null,
    priceLevel,
    attributes: mergeAttributes(d.attributes, existing?.attributes),
    facilities: [...new Set(d.facilities)],
    accessibilityNote: d.accessibilityNote || null,
    images,
    sourceDetail: d.sourceDetail || null,
    status: d.status,
    editorsPick: d.editorsPick,
    hiddenGem: d.hiddenGem,
    hiddenGemNoteEn: d.hiddenGemNoteEn || null,
    hiddenGemNoteAr: d.hiddenGemNoteAr || null,
    flaggedOutdated: d.markVerified ? false : d.flaggedOutdated,
    updatedAt: now,
  };
  if (d.markVerified) {
    values.verification = "verified";
    values.lastVerifiedAt = now;
  }
  return { values, markVerified: d.markVerified };
}

/* ------------------------------------------------------------------ */
/* Conversions & lookups                                                */
/* ------------------------------------------------------------------ */

export function placeToForm(p: Place): PlaceFormValues {
  const attributes: PlaceFormValues["attributes"] = {};
  for (const key of ATTR_KEYS) {
    const a = p.attributes?.[key];
    attributes[key] = a ? { value: a.value, verified: a.source === "verified", source: a.source } : { value: null, verified: false };
  }
  const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  return {
    nameEn: str(p.nameEn),
    nameAr: str(p.nameAr),
    category: p.category,
    secondaryCategories: p.secondaryCategories ?? [],
    subcategory: str(p.subcategory),
    lat: String(p.lat),
    lng: String(p.lng),
    neighbourhood: str(p.neighbourhood),
    address: str(p.address),
    phone: str(p.phone),
    website: str(p.website),
    instagram: str(p.instagram),
    openingHours: str(p.openingHours),
    hoursSource: str(p.hoursSource),
    priceMin: str(p.priceMin),
    priceMax: str(p.priceMax),
    priceSource: str(p.priceSource),
    priceLevel: str(p.priceLevel),
    descriptionEn: str(p.descriptionEn),
    descriptionAr: str(p.descriptionAr),
    accessibilityNote: str(p.accessibilityNote),
    tags: p.tags ?? [],
    occasions: p.occasions ?? [],
    facilities: p.facilities ?? [],
    attributes,
    images: (p.images ?? []).map(imageToInput),
    sourceDetail: str(p.sourceDetail),
    status: p.status,
    editorsPick: p.editorsPick,
    hiddenGem: p.hiddenGem,
    hiddenGemNoteEn: str(p.hiddenGemNoteEn),
    hiddenGemNoteAr: str(p.hiddenGemNoteAr),
    flaggedOutdated: p.flaggedOutdated,
    markVerified: false,
  };
}

export function emptyPlaceForm(): PlaceFormValues {
  const attributes: PlaceFormValues["attributes"] = {};
  for (const key of ATTR_KEYS) attributes[key] = { value: null, verified: false };
  return {
    nameEn: "",
    nameAr: "",
    category: "",
    secondaryCategories: [],
    subcategory: "",
    lat: "",
    lng: "",
    neighbourhood: "",
    address: "",
    phone: "",
    website: "",
    instagram: "",
    openingHours: "",
    hoursSource: "",
    priceMin: "",
    priceMax: "",
    priceSource: "",
    priceLevel: "",
    descriptionEn: "",
    descriptionAr: "",
    accessibilityNote: "",
    tags: [],
    occasions: [],
    facilities: [],
    attributes,
    images: [],
    sourceDetail: "",
    status: "draft",
    editorsPick: false,
    hiddenGem: false,
    hiddenGemNoteEn: "",
    hiddenGemNoteAr: "",
    flaggedOutdated: false,
    markVerified: false,
  };
}

/** Escapes LIKE wildcards in user input. */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function searchPlaces(q: string, opts: { publishedOnly?: boolean; limit?: number } = {}): Promise<PlaceHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const pat = likePattern(term);
  const match = or(
    sql`${places.nameEn} like ${pat} escape '\\'`,
    sql`${places.nameAr} like ${pat} escape '\\'`,
    sql`${places.slug} like ${pat} escape '\\'`,
    eq(places.id, term),
  );
  const rows = await db
    .select({
      id: places.id,
      slug: places.slug,
      nameEn: places.nameEn,
      nameAr: places.nameAr,
      category: places.category,
      status: places.status,
      lat: places.lat,
      lng: places.lng,
      neighbourhood: places.neighbourhood,
    })
    .from(places)
    .where(opts.publishedOnly ? and(match, eq(places.status, "published")) : and(match, ne(places.status, "archived")))
    // Exact and prefix matches first, then the rest alphabetically.
    .orderBy(
      sql`case when lower(coalesce(${places.nameEn}, '')) = lower(${term}) or ${places.nameAr} = ${term} then 0
               when lower(coalesce(${places.nameEn}, '')) like lower(${`${term}%`}) or ${places.nameAr} like ${`${term}%`} then 1 else 2 end`,
      sql`coalesce(${places.nameEn}, ${places.nameAr})`,
    )
    .limit(opts.limit ?? 12);
  return rows;
}
