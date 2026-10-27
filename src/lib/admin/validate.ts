/**
 * Small, dependency-free validators shared by admin forms and the admin API.
 */

/** Jeddah bounding box used for every admin-entered coordinate. */
export const JEDDAH_LAT: [number, number] = [21.2, 22.0];
export const JEDDAH_LNG: [number, number] = [38.9, 39.45];

export function inJeddah(lat: number, lng: number): boolean {
  return lat >= JEDDAH_LAT[0] && lat <= JEDDAH_LAT[1] && lng >= JEDDAH_LNG[0] && lng <= JEDDAH_LNG[1];
}

export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".") && !/\s/.test(value);
  } catch {
    return false;
  }
}

const AR_DIGITS = /[٠-٩۰-۹]/g;
function westernDigits(s: string) {
  return s.replace(AR_DIGITS, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d) >= 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(d) : "۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/**
 * Normalises a Saudi phone number. Returns null when it isn't one.
 *  - mobiles and landlines → +966XXXXXXXXX (e.g. +966551234567, +966126543210)
 *  - unified numbers 920XXXXXX and toll-free 800XXXXXXX are kept as dialled
 */
export function normalizeSaudiPhone(input: string): string | null {
  let s = westernDigits(input).replace(/[\s\-().]/g, "");
  if (s.startsWith("00966")) s = `+966${s.slice(5)}`;
  if (/^920\d{6}$/.test(s) || /^800\d{7}$/.test(s)) return s;
  if (s.startsWith("+966")) s = s.slice(4);
  else if (s.startsWith("966") && s.length === 12) s = s.slice(3);
  else if (s.startsWith("0")) s = s.slice(1);
  if (/^5\d{8}$/.test(s) || /^1[1-7]\d{7}$/.test(s)) return `+966${s}`;
  return null;
}

/** Accepts "@handle", "handle" or an instagram.com profile URL; returns the canonical profile URL. */
export function normalizeInstagram(input: string): string | null {
  const s = input.trim();
  let handle = s;
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i);
  if (m) handle = m[1];
  else handle = s.replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return `https://www.instagram.com/${handle}`;
}

export function isIsoDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Internal app path such as "/explore?cat=beaches" (no protocol, no "//"). */
export function isAppPath(s: string): boolean {
  return /^\/(?!\/)[^\s]*$/.test(s) && !/^\/(en|ar)(\/|$)/.test(s);
}

export function isHexColor(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

/** URL-safe slug from a (Latin) name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Parses a whole number typed by a user; "" → null, invalid → NaN. */
export function parseWhole(s: string): number | null {
  const t = westernDigits(s.trim()).replace(/[,\s]/g, "");
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

/** Parses a decimal coordinate; "" → null, invalid → NaN. */
export function parseCoord(s: string): number | null {
  const t = westernDigits(s.trim()).replace(/٫/g, ".");
  if (!t) return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}
