/**
 * Creates the database schema and loads the seed data.
 *
 *   npm run setup            # migrate + seed (safe to re-run; keeps admin edits)
 *   npm run seed -- --refresh   # also refresh imported fields of existing places
 *
 * Seed sources (all in data/seed, all real and attributed):
 *   anchors.json          editor-researched landmarks (OSM/Wikidata/official sites, Wikimedia photos)
 *   overture-places.json  restaurants, cafés, malls and venues from Overture Maps
 *   neighbourhoods.json   OSM neighbourhood polygons via Overture divisions
 *   guides.json           editorial neighbourhood introductions (EN/AR)
 *   hero.json             homepage hero slides (Wikimedia Commons photos)
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import {
  categories,
  heroSlides,
  neighbourhoods,
  places,
  users,
  type ImageCredit,
  type NewPlace,
  type PlaceAttributes,
} from "../src/lib/db/schema";
import { CATEGORIES, OUTDOORS } from "../src/lib/taxonomy";
import { hashPassword, newId } from "../src/lib/auth/password";
import { haversineKm } from "../src/lib/places/estimates";
import { normalizeText } from "../src/lib/search/normalize";

const ROOT = path.resolve(__dirname, "..");
const SEED = path.join(ROOT, "data", "seed");
const refresh = process.argv.includes("--refresh");

function load<T>(file: string): T | null {
  const p = path.join(SEED, file);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

type Anchor = {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  category: string;
  secondaryCategories?: string[];
  subcategory: string;
  lat: number;
  lng: number;
  coordSource: string;
  neighbourhood?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  instagram?: string | null;
  openingHours?: string | null;
  hoursSource?: string | null;
  wheelchair?: "yes" | "no" | "limited" | null;
  fee?: "yes" | "no" | null;
  public?: boolean;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  tags?: string[];
  occasions?: string[];
  facilities?: string[];
  attributes?: Partial<Record<keyof PlaceAttributes, boolean>>;
  images?: ImageCredit[];
  editorsPick?: boolean;
  hiddenGem?: boolean;
  hiddenGemNoteEn?: string;
  hiddenGemNoteAr?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  priceSource?: string | null;
  verifiedAt?: string;
  sourceDetail?: string;
  /** "unverified" when the researcher couldn't confirm current details */
  verification?: "verified" | "unverified";
};

type OverturePlace = {
  overtureId: string;
  slug: string;
  nameEn: string | null;
  nameAr: string | null;
  category: string;
  secondary: string[];
  subcategory: string;
  confidence: number;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  address: string | null;
  neighbourhood: string;
  lat: number;
  lng: number;
  sources: string[];
};

type Hood = {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  center: [number, number];
  bbox: [number, number, number, number];
  polygon: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] };
};

type Guide = {
  slug: string;
  introEn: string;
  introAr: string;
  practicalEn: string;
  practicalAr: string;
  hero?: ImageCredit;
  sortOrder?: number;
};

type Hero = {
  id: string;
  theme: string;
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  href: string;
  image: ImageCredit;
};

/* ------------------------------------------------------------------ */
/* Attribute inference (always labelled "category" in the UI)          */
/* ------------------------------------------------------------------ */

function inferAttributes(category: string, sub: string | null, secondary: string[]): PlaceAttributes {
  const a: PlaceAttributes = {};
  const set = (k: keyof PlaceAttributes, v: boolean) => (a[k] = { value: v, source: "category" });
  const s = sub ?? "";
  const has = (c: string) => category === c || secondary.includes(c);

  if (has("family") || ["outdoors", "beaches", "shopping"].includes(category) || /museum|aquarium|theme_park|water_park|movie_theater|fairgrounds|bowling|arcade/.test(s))
    set("familyFriendly", true);
  if (category === "shopping" || /movie_theater|fairgrounds|escape_room|bowling|arcade|comedy|museum|art_gallery|cultural_center|trampoline|aquarium/.test(s) || s === "sport_or_fitness_facility")
    set("indoor", true);
  if (["beaches", "outdoors"].includes(category) || /scuba|diving|horse|race_track|bike_rental|theme_park|water_park|district|waterfront|marina|landmark/.test(s))
    set("outdoor", true);
  if (["entertainment", "adventure", "sports", "beaches", "outdoors"].includes(category) || has("family")) set("groups", true);
  if (category === "shopping" && /mall|souq|shopping_street/.test(s)) set("free", true);
  // Public spaces with no entry: districts, streets, mosques, parks, promenades and outdoor landmarks.
  // Not beaches: many in Jeddah (especially Obhur) charge for access.
  if (category !== "beaches" && /^(district|shopping_street|souq|mosque|park|waterfront|landmark)$/.test(s)) set("free", true);
  return a;
}

function brandKey(name: string | null): string | null {
  if (!name) return null;
  return normalizeText(name).replace(/\s+/g, "");
}

function stableId(prefix: string, key: string) {
  return `${prefix}_${createHash("sha1").update(key).digest("hex").slice(0, 14)}`;
}

/* ------------------------------------------------------------------ */

async function main() {
  const db = getDb();
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: path.join(ROOT, "drizzle") });
  await db.run(sql`PRAGMA foreign_keys = ON`);

  // Categories
  const allCats = [...CATEGORIES, OUTDOORS];
  for (const [i, c] of allCats.entries()) {
    await db
      .insert(categories)
      .values({
        slug: c.slug,
        nameEn: c.name.en,
        nameAr: c.name.ar,
        taglineEn: c.tagline.en,
        taglineAr: c.tagline.ar,
        color: c.color,
        sortOrder: i,
        showOnHome: c.slug !== "outdoors",
      })
      .onConflictDoNothing();
  }
  console.log(`Categories: ${allCats.length}`);

  // Neighbourhoods
  const hoodFile = load<{ neighbourhoods: Hood[] }>("neighbourhoods.json");
  const guides = new Map((load<Guide[]>("guides.json") ?? []).map((g) => [g.slug, g]));
  if (hoodFile) {
    for (const h of hoodFile.neighbourhoods) {
      const g = guides.get(h.slug);
      const values = {
        slug: h.slug,
        nameEn: h.nameEn,
        nameAr: h.nameAr,
        centerLat: h.center[0],
        centerLng: h.center[1],
        bbox: h.bbox,
        polygon: h.polygon,
        introEn: g?.introEn ?? null,
        introAr: g?.introAr ?? null,
        practicalEn: g?.practicalEn ?? null,
        practicalAr: g?.practicalAr ?? null,
        hero: g?.hero ?? null,
        featured: !!g,
        sortOrder: g?.sortOrder ?? 100,
        source: "osm",
      };
      await db
        .insert(neighbourhoods)
        .values(values)
        .onConflictDoUpdate({
          target: neighbourhoods.slug,
          set: refresh || g ? values : { polygon: values.polygon, bbox: values.bbox },
        });
    }
    console.log(`Neighbourhoods: ${hoodFile.neighbourhoods.length} (${guides.size} with guides)`);
  }

  const hoodSlugs = new Set((await db.select({ slug: neighbourhoods.slug }).from(neighbourhoods)).map((h) => h.slug));

  // Anchors (editorial)
  const anchors = load<Anchor[]>("anchors.json") ?? [];
  const anchorRows: NewPlace[] = anchors.map((a) => {
    const attrs = inferAttributes(a.category, a.subcategory, a.secondaryCategories ?? []);
    for (const [k, v] of Object.entries(a.attributes ?? {})) attrs[k as keyof PlaceAttributes] = { value: v, source: "verified" };
    // Researched indoor/outdoor beats the guess from the type of place.
    if (a.attributes?.indoor && !a.attributes.outdoor && attrs.outdoor?.source === "category") delete attrs.outdoor;
    if (a.attributes?.outdoor && !a.attributes.indoor && attrs.indoor?.source === "category") delete attrs.indoor;
    if (a.wheelchair) attrs.wheelchair = { value: a.wheelchair !== "no", source: "osm" };
    if (a.fee === "no" || a.public) attrs.free = { value: true, source: a.fee === "no" ? "osm" : "verified" };
    if (a.fee === "yes") attrs.free = { value: false, source: "osm" };
    return {
      id: `ed_${a.slug}`,
      slug: a.slug,
      nameEn: a.nameEn,
      nameAr: a.nameAr,
      category: a.category,
      secondaryCategories: a.secondaryCategories ?? [],
      subcategory: a.subcategory,
      tags: a.tags ?? [],
      occasions: a.occasions ?? [],
      descriptionEn: a.descriptionEn ?? null,
      descriptionAr: a.descriptionAr ?? null,
      lat: a.lat,
      lng: a.lng,
      neighbourhood: a.neighbourhood && hoodSlugs.has(a.neighbourhood) ? a.neighbourhood : null,
      address: a.address ?? null,
      phone: a.phone ?? null,
      website: a.website ?? null,
      instagram: a.instagram ?? null,
      openingHours: a.openingHours ?? null,
      hoursSource: a.openingHours ? (a.hoursSource ?? "OpenStreetMap") : null,
      hoursCheckedAt: a.openingHours && a.verifiedAt ? new Date(a.verifiedAt) : null,
      priceMin: a.priceMin ?? null,
      priceMax: a.priceMax ?? null,
      priceSource: a.priceSource ?? null,
      priceCheckedAt: a.priceSource && a.verifiedAt ? new Date(a.verifiedAt) : null,
      attributes: attrs,
      facilities: a.facilities ?? [],
      images: a.images ?? [],
      source: "editorial",
      sourceRef: a.coordSource,
      sourceDetail: a.sourceDetail ?? null,
      verification: a.verification ?? "verified",
      lastVerifiedAt: a.verifiedAt ? new Date(a.verifiedAt) : new Date(),
      status: "published",
      editorsPick: !!a.editorsPick,
      hiddenGem: !!a.hiddenGem,
      hiddenGemNoteEn: a.hiddenGemNoteEn ?? null,
      hiddenGemNoteAr: a.hiddenGemNoteAr ?? null,
    };
  });

  // Overture imports
  const ov = load<{ places: OverturePlace[]; release: string }>("overture-places.json");
  const overtureRows: NewPlace[] = [];
  let skippedDup = 0;
  if (ov) {
    const brandCounts = new Map<string, number>();
    for (const p of ov.places) {
      const k = brandKey(p.nameEn ?? p.nameAr);
      if (k) brandCounts.set(k, (brandCounts.get(k) ?? 0) + 1);
    }
    const anchorKeys = anchorRows.map((a) => ({
      keys: [brandKey(a.nameEn ?? null), brandKey(a.nameAr ?? null)].filter(Boolean) as string[],
      lat: a.lat,
      lng: a.lng,
    }));
    for (const p of ov.places) {
      const k1 = brandKey(p.nameEn);
      const k2 = brandKey(p.nameAr);
      // Skip records that duplicate an editor-researched anchor nearby.
      const dup = anchorKeys.some(
        (a) =>
          haversineKm(a, p) < 0.4 &&
          a.keys.some((k) => (k1 && (k.includes(k1) || k1.includes(k))) || (k2 && (k.includes(k2) || k2.includes(k)))),
      );
      if (dup) {
        skippedDup++;
        continue;
      }
      const key = k1 ?? k2;
      const isChain = !!key && (brandCounts.get(key) ?? 0) >= 4;
      const attributes = inferAttributes(p.category, p.subcategory, p.secondary);
      overtureRows.push({
        id: stableId("ov", p.overtureId),
        slug: p.slug,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        category: p.category,
        secondaryCategories: p.secondary,
        subcategory: p.subcategory,
        lat: p.lat,
        lng: p.lng,
        neighbourhood: hoodSlugs.has(p.neighbourhood) ? p.neighbourhood : null,
        address: p.address,
        phone: p.phone,
        website: p.website,
        instagram: p.instagram,
        attributes,
        brand: isChain ? key : null,
        isChain,
        source: "overture",
        sourceRef: `overture:${p.overtureId}`,
        sourceDetail: `${p.sources.filter((s) => s !== "Overture").join(", ")} via Overture Maps ${ov.release} (confidence ${p.confidence})`,
        verification: "unverified",
        status: "published",
      });
    }
  }

  const allRows = [...anchorRows, ...overtureRows];
  const BATCH = 200;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const chunk = allRows.slice(i, i + BATCH);
    if (refresh) {
      for (const row of chunk) {
        await db
          .insert(places)
          .values(row)
          .onConflictDoUpdate({
            target: places.id,
            set: {
              nameEn: row.nameEn,
              nameAr: row.nameAr,
              lat: row.lat,
              lng: row.lng,
              address: row.address,
              phone: row.phone,
              website: row.website,
              instagram: row.instagram,
              neighbourhood: row.neighbourhood,
              ...(row.source === "editorial"
                ? {
                    descriptionEn: row.descriptionEn,
                    descriptionAr: row.descriptionAr,
                    images: row.images,
                    openingHours: row.openingHours,
                    attributes: row.attributes,
                    tags: row.tags,
                    occasions: row.occasions,
                    editorsPick: row.editorsPick,
                    hiddenGem: row.hiddenGem,
                    hiddenGemNoteEn: row.hiddenGemNoteEn,
                    hiddenGemNoteAr: row.hiddenGemNoteAr,
                    secondaryCategories: row.secondaryCategories,
                    category: row.category,
                    subcategory: row.subcategory,
                    hoursSource: row.hoursSource,
                    sourceRef: row.sourceRef,
                    sourceDetail: row.sourceDetail,
                    verification: row.verification,
                    lastVerifiedAt: row.lastVerifiedAt,
                  }
                : {}),
              updatedAt: new Date(),
            },
          });
      }
    } else {
      await db.insert(places).values(chunk).onConflictDoNothing();
    }
  }
  console.log(`Places: ${anchorRows.length} editorial + ${overtureRows.length} imported (${skippedDup} duplicates of anchors skipped)`);

  // Hero slides
  const hero = load<Hero[]>("hero.json") ?? [];
  for (const [i, h] of hero.entries()) {
    await db
      .insert(heroSlides)
      .values({ ...h, sortOrder: i, active: true })
      .onConflictDoUpdate({ target: heroSlides.id, set: refresh ? { ...h, sortOrder: i } : { image: h.image } });
  }
  console.log(`Hero slides: ${hero.length}`);

  // Optional first administrator
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing) {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
      console.log(`Promoted ${adminEmail} to admin`);
    } else {
      await db.insert(users).values({
        id: newId(),
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        displayName: process.env.ADMIN_NAME || "Administrator",
        role: "admin",
      });
      console.log(`Created admin ${adminEmail}`);
    }
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
