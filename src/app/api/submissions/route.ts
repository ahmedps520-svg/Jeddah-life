import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { places, submissions } from "@/lib/db/schema";
import { body, handler, HttpError, json, mutationUser } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { newId } from "@/lib/auth/password";
import { GEM_TYPES } from "@/lib/taxonomy";
import { inJeddah, neighbourhoodAt } from "@/lib/geo";
import { haversineKm } from "@/lib/places/estimates";
import { normalizeText } from "@/lib/search/normalize";

const B = z.object({
  name: z.string().trim().min(2).max(80),
  gemType: z.enum(GEM_TYPES.map((g) => g.slug) as [string, ...string[]]),
  description: z.string().trim().min(40).max(1200),
  tips: z.string().trim().max(600).optional(),
  placeId: z.string().max(64).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  photos: z
    .array(z.object({ url: z.string().regex(/^\/uploads\/submissions\/[A-Za-z0-9_-]+\.webp$/), width: z.number().optional(), height: z.number().optional() }))
    .max(3)
    .default([]),
});

/**
 * A community hidden-gem recommendation. It's stored as pending and only
 * appears publicly after a moderator approves it.
 */
export const POST = handler(async (req: Request) => {
  const user = await mutationUser();
  const data = await body(req, B);
  if (!(await rateLimit(`submission:${user.id}`, 5, 86400))) throw new HttpError(429, "rate_limited");

  let lat = data.lat ?? null;
  let lng = data.lng ?? null;
  let placeId: string | null = null;
  if (data.placeId) {
    const [p] = await db.select({ id: places.id, lat: places.lat, lng: places.lng }).from(places).where(and(eq(places.id, data.placeId), eq(places.status, "published")));
    if (!p) throw new HttpError(400, "unknown_place");
    placeId = p.id;
    lat ??= p.lat;
    lng ??= p.lng;
  }
  if (lat == null || lng == null) throw new HttpError(400, "location_required");
  if (!inJeddah(lat, lng)) throw new HttpError(400, "outside_jeddah");

  // One open recommendation per place (or same name nearby) per person.
  const mine = await db.select().from(submissions).where(and(eq(submissions.userId, user.id), eq(submissions.status, "pending")));
  const key = normalizeText(data.name);
  if (mine.some((s) => (placeId && s.placeId === placeId) || (normalizeText(s.name) === key && s.lat != null && s.lng != null && haversineKm({ lat: s.lat, lng: s.lng }, { lat, lng }) < 0.3))) {
    throw new HttpError(409, "duplicate");
  }

  const id = newId();
  await db.insert(submissions).values({
    id,
    userId: user.id,
    placeId,
    name: data.name,
    gemType: data.gemType,
    description: data.description,
    tips: data.tips || null,
    lat,
    lng,
    neighbourhood: await neighbourhoodAt(lat, lng),
    photos: data.photos.map((p) => ({ url: p.url, width: p.width, height: p.height, origin: "upload" })),
    status: "pending",
  });
  return json({ ok: true, id });
});
