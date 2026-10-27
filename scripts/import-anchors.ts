/**
 * Turns the editorial research in data/research/anchors/ into seed data.
 *
 *   npm run anchors
 *
 * Reads
 *   data/research/anchors/anchors.json   researched landmarks (OSM/Wikidata/official sources)
 *   data/research/anchors/hero.json      homepage photos (Wikimedia Commons)
 *   data/seed/anchor-editorial.json      bilingual descriptions, tags and attributes (optional)
 *   data/raw/anchor-images/*.jpg         downloaded Commons photos (gitignored)
 *
 * Writes
 *   data/seed/anchors.json, data/seed/hero.json, hero images on data/seed/guides.json
 *   public/images/places/<slug>.webp, public/images/hero/<name>.webp
 *
 * Neighbourhoods are assigned by point-in-polygon against the boundary
 * data rather than trusted from free text. Records the researcher marked
 * "uncertain" are imported as unverified, so the UI labels them honestly.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const RESEARCH = path.join(ROOT, "data", "research", "anchors");
const RAW_IMAGES = path.join(ROOT, "data", "raw", "anchor-images");
const SEED = path.join(ROOT, "data", "seed");

type Researched = {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  category: string;
  secondaryCategories: string[];
  lat: number;
  lng: number;
  coordSource: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  openingHours: string | null;
  wheelchair: "yes" | "no" | "limited" | null;
  fee: "yes" | "no" | null;
  facts: string;
  status: "verified" | "uncertain";
  notes: string;
  image: null | {
    file: string;
    pageUrl: string;
    width: number;
    height: number;
    author: string;
    license: string;
    licenseUrl: string | null;
  };
};

type Editorial = {
  subcategory: string;
  descriptionEn: string;
  descriptionAr: string;
  tags: string[];
  occasions: string[];
  attributes: Record<string, boolean>;
  editorsPick: boolean;
};

type HeroResearch = {
  file: string;
  theme: string;
  captionEn: string;
  pageUrl: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  width: number;
  height: number;
};

type Polygon = { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
type Hood = { slug: string; polygon: Polygon };

const RESEARCHED_ON = "2026-10-26";

/** Fallback subcategories when no editorial file is present. */
const DEFAULT_SUB: Record<string, string> = {
  culture: "landmark",
  shopping: "shopping_mall",
  entertainment: "venue",
  outdoors: "park",
  family: "theme_park",
  sports: "stadium_arena",
  beaches: "beach",
  adventure: "venue",
};

/** Copy for the homepage slides, keyed by research file name. */
const HERO_COPY: Record<string, { theme: string; href: string; titleEn: string; titleAr: string; subtitleEn: string; subtitleAr: string }> = {
  "hero-historic-1": {
    theme: "historic",
    href: "/neighbourhoods/al-balad",
    titleEn: "Wander historic Al-Balad",
    titleAr: "تجوّل في البلد التاريخية",
    subtitleEn: "Coral-stone houses, roshan balconies and old souqs in a UNESCO World Heritage Site.",
    subtitleAr: "بيوت من الحجر المنقبي ورواشين خشبية وأسواق قديمة في موقع مُدرج على قائمة التراث العالمي.",
  },
  "hero-waterfront-2": {
    theme: "waterfront",
    href: "/place/king-fahds-fountain",
    titleEn: "Sunset by the Red Sea",
    titleAr: "غروب على البحر الأحمر",
    subtitleEn: "Watch King Fahd's Fountain rise over the water from the Corniche.",
    subtitleAr: "شاهد نافورة الملك فهد ترتفع فوق الماء من الكورنيش.",
  },
  "hero-modern-2": {
    theme: "entertainment",
    href: "/category/entertainment",
    titleEn: "Jeddah after dark",
    titleAr: "جدة بعد الغروب",
    subtitleEn: "Cinemas, late cafés and evening plans across the city.",
    subtitleAr: "سينما ومقاهٍ تسهر حتى وقت متأخر وخطط مسائية في أنحاء المدينة.",
  },
  "hero-food-1": {
    theme: "food",
    href: "/category/restaurants",
    titleEn: "Taste the city",
    titleAr: "تذوّق المدينة",
    subtitleEn: "From souq snacks to seafood — find where to eat tonight.",
    subtitleAr: "من مكسّرات الأسواق إلى المأكولات البحرية، اعرف أين تأكل الليلة.",
  },
  "hero-outdoor-1": {
    theme: "weekend",
    href: "/neighbourhoods/abhur-ash-shamaliyah",
    titleEn: "Weekend by the water",
    titleAr: "عطلة على البحر",
    subtitleEn: "Beaches, diving and long afternoons around Sharm Obhur.",
    subtitleAr: "شواطئ وغوص وأمسيات طويلة حول شرم أبحر.",
  },
  "hero-waterfront-1": {
    theme: "waterfront",
    href: "/place/jeddah-waterfront",
    titleEn: "Sea air on the Corniche",
    titleAr: "نسيم البحر على الكورنيش",
    subtitleEn: "Promenades, beaches and parks along the Red Sea.",
    subtitleAr: "ممشى وشواطئ وحدائق على امتداد البحر الأحمر.",
  },
  "hero-modern-1": {
    theme: "entertainment",
    href: "/place/jeddah-yacht-club",
    titleEn: "Marina evenings",
    titleAr: "أمسيات المارينا",
    subtitleEn: "Waterfront dining and city views at the Jeddah Yacht Club.",
    subtitleAr: "مطاعم على الواجهة البحرية وإطلالات على المدينة في نادي جدة لليخوت.",
  },
  "hero-historic-2": {
    theme: "historic",
    href: "/category/culture",
    titleEn: "Gates, souqs and stories",
    titleAr: "أبواب وأسواق وحكايات",
    subtitleEn: "Museums, heritage houses and landmarks worth the trip.",
    subtitleAr: "متاحف وبيوت تراثية ومعالم تستحق الزيارة.",
  },
  "hero-outdoor-2": {
    theme: "weekend",
    href: "/category/beaches",
    titleEn: "Open-air weekends",
    titleAr: "عطلات في الهواء الطلق",
    subtitleEn: "Public promenades and beaches for an easy day out.",
    subtitleAr: "ممشى وشواطئ عامة ليوم خروج بسيط.",
  },
};

/** Preferred guide photos; otherwise any researched photo inside the area is used. */
const GUIDE_HERO: Record<string, string[]> = {
  "al-balad": ["historic-jeddah-al-balad", "nasseef-house"],
  "al-hamra": ["middle-corniche-park"],
  "al-shatee": ["jeddah-waterfront", "al-rahma-mosque"],
  "abhur-ash-shamaliyah": ["hero:hero-outdoor-1", "obhur-creek"],
};

function readJson<T>(p: string): T | null {
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
}

function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, poly: Polygon): boolean {
  const polys = (poly.type === "Polygon" ? [poly.coordinates] : poly.coordinates) as number[][][][];
  return polys.some(([outer, ...holes]) => inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h)));
}

function sourceUrls(facts: string): string[] {
  return [...new Set(facts.match(/https?:\/\/[^\s,;)]+/g) ?? [])].map((u) => u.replace(/[.]$/, ""));
}

function coordLabel(coordSource: string): string {
  const [kind, ref] = coordSource.split(":");
  const name = kind === "osm" ? "OpenStreetMap" : kind === "wikidata" ? "Wikidata" : kind === "overture" ? "Overture Maps" : kind;
  return `${name} (${ref})`;
}

async function toWebp(src: string, dest: string): Promise<{ width: number; height: number }> {
  mkdirSync(path.dirname(dest), { recursive: true });
  const info = await sharp(src)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 76 })
    .toFile(dest);
  return { width: info.width, height: info.height };
}

async function main() {
  const researched = readJson<Researched[]>(path.join(RESEARCH, "anchors.json"));
  if (!researched) throw new Error("data/research/anchors/anchors.json not found");
  const editorial = readJson<Record<string, Editorial>>(path.join(SEED, "anchor-editorial.json")) ?? {};
  const hoods = readJson<{ neighbourhoods: Hood[] }>(path.join(SEED, "neighbourhoods.json"))?.neighbourhoods ?? [];
  const haveRaw = existsSync(RAW_IMAGES);
  if (!haveRaw) console.warn("data/raw/anchor-images/ is missing — keeping any images already in public/images.");

  // Inside a boundary, or else the closest one within 2.5 km (piers, the
  // fountain and lagoon points sit just offshore of the polygons).
  const hoodOf = (lat: number, lng: number): string | null => {
    const inside = hoods.find((h) => inPolygon(lng, lat, h.polygon));
    if (inside) return inside.slug;
    let best: { slug: string; km: number } | null = null;
    const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    for (const h of hoods) {
      const polys = (h.polygon.type === "Polygon" ? [h.polygon.coordinates] : h.polygon.coordinates) as number[][][][];
      for (const ring of polys.map((p) => p[0])) {
        for (const [x, y] of ring) {
          const km = Math.hypot((x - lng) * kmPerDegLng, (y - lat) * 110.57);
          if (!best || km < best.km) best = { slug: h.slug, km };
        }
      }
    }
    return best && best.km <= 2.5 ? best.slug : null;
  };
  const imageBySlug = new Map<string, Record<string, unknown>>();

  const anchors = [];
  for (const r of researched) {
    const ed = editorial[r.slug];
    let images: Record<string, unknown>[] = [];
    if (r.image) {
      const rel = `/images/places/${r.slug}.webp`;
      const dest = path.join(ROOT, "public", rel);
      const raw = path.join(RAW_IMAGES, path.basename(r.image.file));
      let size = { width: r.image.width, height: r.image.height };
      if (haveRaw && existsSync(raw)) size = await toWebp(raw, dest);
      if (existsSync(dest)) {
        const credit = {
          url: rel,
          width: size.width,
          height: size.height,
          alt: r.nameEn,
          author: r.image.author,
          license: r.image.license,
          licenseUrl: r.image.licenseUrl,
          sourceUrl: r.image.pageUrl,
          origin: "commons",
        };
        images = [credit];
        imageBySlug.set(r.slug, credit);
      }
    }
    const urls = sourceUrls(r.facts);
    const attributes = ed?.attributes ?? {};
    anchors.push({
      slug: r.slug,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      category: r.category,
      secondaryCategories: r.secondaryCategories ?? [],
      subcategory: ed?.subcategory ?? DEFAULT_SUB[r.category] ?? "landmark",
      lat: r.lat,
      lng: r.lng,
      coordSource: r.coordSource,
      neighbourhood: hoodOf(r.lat, r.lng),
      address: r.address,
      website: r.website,
      phone: r.phone,
      openingHours: r.openingHours,
      hoursSource: r.openingHours ? "OpenStreetMap" : null,
      wheelchair: r.wheelchair,
      fee: r.fee,
      descriptionEn: ed?.descriptionEn ?? null,
      descriptionAr: ed?.descriptionAr ?? null,
      tags: ed?.tags ?? [],
      occasions: ed?.occasions ?? [],
      attributes,
      images,
      editorsPick: r.status === "verified" && !!ed?.editorsPick,
      verification: r.status === "verified" ? "verified" : "unverified",
      verifiedAt: RESEARCHED_ON,
      sourceDetail: `Location: ${coordLabel(r.coordSource)}${urls.length ? ` · Sources: ${urls.join(" ")}` : ""}`,
    });
  }
  writeFileSync(path.join(SEED, "anchors.json"), JSON.stringify(anchors, null, 2) + "\n");
  const unassigned = anchors.filter((a) => !a.neighbourhood).map((a) => a.slug);
  console.log(`Anchors: ${anchors.length} (${anchors.filter((a) => a.images.length).length} with photos, ${Object.keys(editorial).length} with editorial copy)`);
  if (unassigned.length) console.log(`  outside neighbourhood boundaries: ${unassigned.join(", ")}`);

  // Homepage slides
  const heroResearch = readJson<HeroResearch[]>(path.join(RESEARCH, "hero.json")) ?? [];
  const heroByName = new Map<string, Record<string, unknown>>();
  const slides = [];
  for (const h of heroResearch) {
    const name = path.basename(h.file, path.extname(h.file));
    const copy = HERO_COPY[name];
    const rel = `/images/hero/${name}.webp`;
    const dest = path.join(ROOT, "public", rel);
    const raw = path.join(RAW_IMAGES, path.basename(h.file));
    let size = { width: h.width, height: h.height };
    if (haveRaw && existsSync(raw)) size = await toWebp(raw, dest);
    if (!existsSync(dest)) continue;
    const image = {
      url: rel,
      width: size.width,
      height: size.height,
      alt: h.captionEn,
      author: h.author,
      license: h.license,
      licenseUrl: h.licenseUrl,
      sourceUrl: h.pageUrl,
      origin: "commons",
    };
    heroByName.set(name, image);
    if (copy) slides.push({ id: name, ...copy, image });
  }
  const order = Object.keys(HERO_COPY);
  slides.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  writeFileSync(path.join(SEED, "hero.json"), JSON.stringify(slides, null, 2) + "\n");
  console.log(`Hero slides: ${slides.length}`);

  // Guide photos
  const guidesPath = path.join(SEED, "guides.json");
  const guides = readJson<Array<Record<string, unknown> & { slug: string }>>(guidesPath);
  if (guides) {
    for (const g of guides) {
      const prefs = GUIDE_HERO[g.slug] ?? [];
      let hero: Record<string, unknown> | undefined;
      for (const ref of prefs) {
        hero = ref.startsWith("hero:") ? heroByName.get(ref.slice(5)) : imageBySlug.get(ref);
        if (hero) break;
      }
      if (!hero) {
        const inside = anchors.find((a) => a.neighbourhood === g.slug && a.images.length);
        hero = inside?.images[0];
      }
      if (hero) g.hero = hero;
      else delete g.hero;
    }
    writeFileSync(guidesPath, JSON.stringify(guides, null, 2) + "\n");
    console.log(`Guides with photos: ${guides.filter((g) => g.hero).length}/${guides.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
