import type { Locale } from "./i18n/config";

export type Bilingual = { en: string; ar: string };

export function pick(b: Bilingual, locale: Locale) {
  return b[locale];
}

/* ------------------------------------------------------------------ */
/* Categories                                                           */
/* ------------------------------------------------------------------ */

export type CategorySlug =
  | "restaurants"
  | "cafes"
  | "entertainment"
  | "beaches"
  | "shopping"
  | "adventure"
  | "family"
  | "nightlife"
  | "sports"
  | "culture"
  | "outdoors";

export type CategoryDef = {
  slug: CategorySlug | "events" | "hidden-gems";
  name: Bilingual;
  tagline: Bilingual;
  /** Base colour used for markers and photo-less covers */
  color: string;
  /** Abstract motif used on designed covers */
  motif: "arcs" | "steam" | "waves" | "grid" | "dots" | "peaks" | "stripes" | "lattice" | "moon" | "rings" | "stars" | "leaf";
  /** Where the home tile links to */
  href?: string;
};

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "restaurants",
    name: { en: "Restaurants", ar: "مطاعم" },
    tagline: { en: "From shawarma counters to seafood by the sea", ar: "من محلات الشاورما إلى المأكولات البحرية على البحر" },
    color: "#C8553D",
    motif: "rings",
  },
  {
    slug: "cafes",
    name: { en: "Cafés", ar: "مقاهي" },
    tagline: { en: "Specialty coffee, desserts and slow afternoons", ar: "قهوة مختصة وحلويات وأمسيات هادئة" },
    color: "#8A5A3B",
    motif: "steam",
  },
  {
    slug: "entertainment",
    name: { en: "Entertainment", ar: "ترفيه" },
    tagline: { en: "Cinemas, games and nights out", ar: "سينما وألعاب وطلعات مسائية" },
    color: "#5B4B8A",
    motif: "stars",
  },
  {
    slug: "beaches",
    name: { en: "Beaches", ar: "شواطئ" },
    tagline: { en: "Corniche shores and Obhur waters", ar: "شواطئ الكورنيش ومياه أبحر" },
    color: "#127C83",
    motif: "waves",
  },
  {
    slug: "shopping",
    name: { en: "Shopping", ar: "تسوّق" },
    tagline: { en: "Malls, souqs and shopping streets", ar: "مولات وأسواق وشوارع تسوّق" },
    color: "#B8955A",
    motif: "grid",
  },
  {
    slug: "adventure",
    name: { en: "Adventure", ar: "مغامرات" },
    tagline: { en: "Diving, riding, jumping and racing", ar: "غوص وركوب خيل وقفز وسباقات" },
    color: "#2F7D4F",
    motif: "peaks",
  },
  {
    slug: "family",
    name: { en: "Family activities", ar: "أنشطة عائلية" },
    tagline: { en: "Places that work for every age", ar: "أماكن تناسب جميع الأعمار" },
    color: "#D9734F",
    motif: "dots",
  },
  {
    slug: "nightlife",
    name: { en: "Nightlife", ar: "سهرات" },
    tagline: { en: "Spots listed as open late", ar: "أماكن تفتح حتى وقت متأخر" },
    color: "#1C3550",
    motif: "moon",
  },
  {
    slug: "sports",
    name: { en: "Sports", ar: "رياضة" },
    tagline: { en: "Stadiums, courts and places to play", ar: "ملاعب وصالات وأماكن للعب" },
    color: "#2E4A66",
    motif: "stripes",
  },
  {
    slug: "culture",
    name: { en: "Culture & history", ar: "ثقافة وتاريخ" },
    tagline: { en: "Al-Balad, museums and galleries", ar: "البلد والمتاحف والمعارض الفنية" },
    color: "#9C6B3F",
    motif: "lattice",
  },
  {
    slug: "events",
    name: { en: "Events", ar: "فعاليات" },
    tagline: { en: "What's on in the city", ar: "ما يحدث في المدينة" },
    color: "#B84A62",
    motif: "arcs",
    href: "/events",
  },
  {
    slug: "hidden-gems",
    name: { en: "Hidden gems", ar: "جواهر خفية" },
    tagline: { en: "Quiet corners locals recommend", ar: "زوايا هادئة يرشّحها أهل جدة" },
    color: "#0E6670",
    motif: "leaf",
    href: "/hidden-gems",
  },
];

/** Not on the home grid but used as a primary category for parks and waterfront walks. */
export const OUTDOORS: CategoryDef = {
  slug: "outdoors",
  name: { en: "Parks & waterfront", ar: "حدائق وواجهات بحرية" },
  tagline: { en: "Open-air walks, parks and promenades", ar: "ممشى وحدائق وواجهات مفتوحة" },
  color: "#3C8C6E",
  motif: "leaf",
};

export const PLACE_CATEGORIES: CategoryDef[] = [
  ...CATEGORIES.filter((c) => c.slug !== "events" && c.slug !== "hidden-gems"),
  OUTDOORS,
];

export function categoryDef(slug: string): CategoryDef {
  return PLACE_CATEGORIES.find((c) => c.slug === slug) ?? CATEGORIES.find((c) => c.slug === slug) ?? OUTDOORS;
}

/* ------------------------------------------------------------------ */
/* Sub-categories (cuisine / venue type)                                */
/* ------------------------------------------------------------------ */

export const SUBCATEGORIES: Record<string, Bilingual> = {
  restaurant: { en: "Restaurant", ar: "مطعم" },
  middle_eastern_restaurant: { en: "Middle Eastern", ar: "شرق أوسطي" },
  burger_restaurant: { en: "Burgers", ar: "برجر" },
  seafood_restaurant: { en: "Seafood", ar: "مأكولات بحرية" },
  pizza_restaurant: { en: "Pizza", ar: "بيتزا" },
  indian_restaurant: { en: "Indian", ar: "هندي" },
  chicken_restaurant: { en: "Chicken", ar: "دجاج" },
  italian_restaurant: { en: "Italian", ar: "إيطالي" },
  breakfast_and_brunch_restaurant: { en: "Breakfast & brunch", ar: "فطور وبرنش" },
  barbecue_restaurant: { en: "Grills", ar: "مشويات" },
  american_restaurant: { en: "American", ar: "أمريكي" },
  asian_restaurant: { en: "Asian", ar: "آسيوي" },
  asian_fusion_restaurant: { en: "Asian fusion", ar: "آسيوي مبتكر" },
  turkish_restaurant: { en: "Turkish", ar: "تركي" },
  chinese_restaurant: { en: "Chinese", ar: "صيني" },
  lebanese_restaurant: { en: "Lebanese", ar: "لبناني" },
  indonesian_restaurant: { en: "Indonesian", ar: "إندونيسي" },
  pakistani_restaurant: { en: "Pakistani", ar: "باكستاني" },
  japanese_restaurant: { en: "Japanese", ar: "ياباني" },
  egyptian_restaurant: { en: "Egyptian", ar: "مصري" },
  steakhouse: { en: "Steakhouse", ar: "ستيك هاوس" },
  french_restaurant: { en: "French", ar: "فرنسي" },
  african_restaurant: { en: "African", ar: "أفريقي" },
  arabian_restaurant: { en: "Arabian", ar: "عربي" },
  mexican_restaurant: { en: "Mexican", ar: "مكسيكي" },
  filipino_restaurant: { en: "Filipino", ar: "فلبيني" },
  mediterranean_restaurant: { en: "Mediterranean", ar: "متوسطي" },
  sushi_restaurant: { en: "Sushi", ar: "سوشي" },
  fish_and_chips_restaurant: { en: "Fish & chips", ar: "سمك وبطاطس" },
  afghani_restaurant: { en: "Afghan", ar: "أفغاني" },
  thai_restaurant: { en: "Thai", ar: "تايلندي" },
  moroccan_restaurant: { en: "Moroccan", ar: "مغربي" },
  salad_bar: { en: "Salads", ar: "سلطات" },
  vegetarian_restaurant: { en: "Vegetarian", ar: "نباتي" },
  vegan_restaurant: { en: "Vegan", ar: "نباتي صرف" },
  korean_restaurant: { en: "Korean", ar: "كوري" },
  greek_restaurant: { en: "Greek", ar: "يوناني" },
  syrian_restaurant: { en: "Syrian", ar: "سوري" },
  spanish_restaurant: { en: "Spanish", ar: "إسباني" },
  malaysian_restaurant: { en: "Malaysian", ar: "ماليزي" },
  brazilian_restaurant: { en: "Brazilian", ar: "برازيلي" },
  ramen_restaurant: { en: "Ramen", ar: "رامن" },
  theme_restaurant: { en: "Theme restaurant", ar: "مطعم بفكرة خاصة" },
  buffet_restaurant: { en: "Buffet", ar: "بوفيه" },
  health_food_restaurant: { en: "Healthy food", ar: "أكل صحي" },
  doner_kebab_restaurant: { en: "Doner & kebab", ar: "دونر وكباب" },
  fast_food_restaurant: { en: "Fast food", ar: "وجبات سريعة" },
  sandwich_shop: { en: "Sandwiches", ar: "سندويتشات" },
  diner: { en: "Diner", ar: "مطعم شعبي" },
  bistro: { en: "Bistro", ar: "بيسترو" },
  food_truck_stand: { en: "Food truck", ar: "عربة طعام" },
  coffee_shop: { en: "Coffee", ar: "قهوة" },
  coffee_roastery: { en: "Coffee roastery", ar: "محمصة قهوة" },
  cafe: { en: "Café", ar: "كافيه" },
  tea_room: { en: "Tea house", ar: "بيت شاي" },
  bubble_tea_shop: { en: "Bubble tea", ar: "بابل تي" },
  smoothie_juice_bar: { en: "Juice bar", ar: "عصائر" },
  ice_cream_shop: { en: "Ice cream", ar: "آيس كريم" },
  gelato_shop: { en: "Gelato", ar: "جيلاتو" },
  frozen_yogurt_shop: { en: "Frozen yoghurt", ar: "زبادي مثلّج" },
  dessert_shop: { en: "Desserts", ar: "حلويات" },
  donut_shop: { en: "Doughnuts", ar: "دونات" },
  cupcake_shop: { en: "Cupcakes", ar: "كب كيك" },
  chocolatier: { en: "Chocolate", ar: "شوكولاتة" },
  bakery: { en: "Bakery", ar: "مخبز" },
  shopping_mall: { en: "Mall", ar: "مول" },
  department_store: { en: "Department store", ar: "متجر متعدد الأقسام" },
  souq: { en: "Souq", ar: "سوق" },
  shopping_street: { en: "Shopping street", ar: "شارع تسوّق" },
  movie_theater: { en: "Cinema", ar: "سينما" },
  fairgrounds: { en: "Cinema", ar: "سينما" },
  escape_room: { en: "Escape room", ar: "غرفة هروب" },
  bowling_alley: { en: "Bowling", ar: "بولينغ" },
  arcade: { en: "Arcade", ar: "صالة ألعاب" },
  comedy_club: { en: "Comedy club", ar: "نادي كوميدي" },
  race_track: { en: "Race track", ar: "حلبة سباق" },
  scuba_diving_center: { en: "Diving centre", ar: "مركز غوص" },
  scuba_diving_instruction: { en: "Diving centre", ar: "مركز غوص" },
  horseback_riding_service: { en: "Horse riding", ar: "ركوب الخيل" },
  stadium_arena: { en: "Stadium", ar: "ملعب" },
  bike_rental: { en: "Bike rental", ar: "تأجير دراجات" },
  sport_or_fitness_facility: { en: "Activity centre", ar: "مركز أنشطة" },
  art_gallery: { en: "Art gallery", ar: "معرض فني" },
  cultural_center: { en: "Cultural centre", ar: "مركز ثقافي" },
  museum: { en: "Museum", ar: "متحف" },
  historic_site: { en: "Historic site", ar: "موقع تاريخي" },
  mosque: { en: "Mosque", ar: "مسجد" },
  landmark: { en: "Landmark", ar: "معلم" },
  beach: { en: "Beach", ar: "شاطئ" },
  park: { en: "Park", ar: "حديقة" },
  waterfront: { en: "Waterfront", ar: "واجهة بحرية" },
  theme_park: { en: "Theme park", ar: "مدينة ألعاب" },
  water_park: { en: "Water park", ar: "حديقة مائية" },
  aquarium: { en: "Aquarium", ar: "أحواض مائية" },
  marina: { en: "Marina", ar: "مرسى" },
  district: { en: "Historic district", ar: "حي تاريخي" },
  venue: { en: "Event venue", ar: "مكان فعاليات" },
  lounge: { en: "Lounge", ar: "لاونج" },
  trampoline_park: { en: "Trampoline park", ar: "صالة ترامبولين" },
  padel: { en: "Padel", ar: "بادل" },
};

export function subcategoryLabel(sub: string | null | undefined, locale: Locale): string | null {
  if (!sub) return null;
  const b = SUBCATEGORIES[sub];
  if (b) return b[locale];
  return null;
}

/* ------------------------------------------------------------------ */
/* Planner vocab                                                        */
/* ------------------------------------------------------------------ */

export const INTERESTS = [
  { slug: "food", name: { en: "Food", ar: "أكل" } },
  { slug: "coffee", name: { en: "Coffee", ar: "قهوة" } },
  { slug: "shopping", name: { en: "Shopping", ar: "تسوّق" } },
  { slug: "adventure", name: { en: "Adventure", ar: "مغامرة" } },
  { slug: "beaches", name: { en: "Beaches", ar: "شواطئ" } },
  { slug: "gaming", name: { en: "Gaming", ar: "ألعاب" } },
  { slug: "sports", name: { en: "Sports", ar: "رياضة" } },
  { slug: "culture", name: { en: "Culture", ar: "ثقافة" } },
  { slug: "photography", name: { en: "Photography", ar: "تصوير" } },
  { slug: "entertainment", name: { en: "Entertainment", ar: "ترفيه" } },
  { slug: "relaxation", name: { en: "Relaxation", ar: "استرخاء" } },
  { slug: "family", name: { en: "Family activities", ar: "أنشطة عائلية" } },
  { slug: "luxury", name: { en: "Luxury experiences", ar: "تجارب فاخرة" } },
] as const;
export type Interest = (typeof INTERESTS)[number]["slug"];

export const GROUP_TYPES = [
  { slug: "solo", size: 1, name: { en: "Solo", ar: "بمفردي" } },
  { slug: "couple", size: 2, name: { en: "Couple", ar: "شخصان" } },
  { slug: "friends", size: 4, name: { en: "Friends", ar: "أصدقاء" } },
  { slug: "family", size: 4, name: { en: "Family", ar: "عائلة" } },
  { slug: "large", size: 8, name: { en: "Large group", ar: "مجموعة كبيرة" } },
  { slug: "custom", size: 3, name: { en: "Custom group", ar: "مجموعة مخصّصة" } },
] as const;
export type GroupType = (typeof GROUP_TYPES)[number]["slug"];

export const TRANSPORT = [
  { slug: "car", name: { en: "Car", ar: "سيارة" } },
  { slug: "ride", name: { en: "Ride-hailing", ar: "تطبيق توصيل" } },
  { slug: "walk", name: { en: "Walking", ar: "مشي" } },
] as const;
export type Transport = (typeof TRANSPORT)[number]["slug"];

/** Gem types for the Hidden Gems feed and community submissions. */
export const GEM_TYPES = [
  { slug: "cafe", name: { en: "Underrated cafés", ar: "مقاهٍ تستحق أكثر" } },
  { slug: "viewpoint", name: { en: "Scenic viewpoints", ar: "إطلالات جميلة" } },
  { slug: "architecture", name: { en: "Interesting architecture", ar: "عمارة لافتة" } },
  { slug: "photo", name: { en: "Photography spots", ar: "أماكن للتصوير" } },
  { slug: "quiet", name: { en: "Quiet places", ar: "أماكن هادئة" } },
  { slug: "affordable", name: { en: "Affordable restaurants", ar: "مطاعم بأسعار معقولة" } },
  { slug: "unique", name: { en: "Unique activities", ar: "أنشطة مختلفة" } },
  { slug: "lesser-known", name: { en: "Lesser-known attractions", ar: "معالم أقل شهرة" } },
] as const;

export const EVENT_CATEGORIES = [
  { slug: "concerts", name: { en: "Concerts", ar: "حفلات موسيقية" } },
  { slug: "festivals", name: { en: "Festivals", ar: "مهرجانات" } },
  { slug: "exhibitions", name: { en: "Exhibitions", ar: "معارض" } },
  { slug: "sports", name: { en: "Sporting events", ar: "فعاليات رياضية" } },
  { slug: "cultural", name: { en: "Cultural events", ar: "فعاليات ثقافية" } },
  { slug: "family", name: { en: "Family activities", ar: "أنشطة عائلية" } },
  { slug: "seasonal", name: { en: "Seasonal attractions", ar: "وجهات موسمية" } },
  { slug: "community", name: { en: "Community events", ar: "فعاليات مجتمعية" } },
  { slug: "workshops", name: { en: "Workshops", ar: "ورش عمل" } },
  { slug: "special", name: { en: "Special experiences", ar: "تجارب خاصة" } },
] as const;

export const OCCASIONS = [
  { slug: "birthday", name: { en: "Birthdays", ar: "أعياد الميلاد" } },
  { slug: "date", name: { en: "Date night", ar: "سهرة لشخصين" } },
  { slug: "friends", name: { en: "Friends' outing", ar: "طلعة أصدقاء" } },
  { slug: "family", name: { en: "Family day", ar: "يوم عائلي" } },
  { slug: "visitors", name: { en: "Showing visitors around", ar: "استقبال الزوار" } },
  { slug: "work", name: { en: "Work meeting", ar: "اجتماع عمل" } },
  { slug: "photos", name: { en: "Photos", ar: "التصوير" } },
] as const;

export const FACILITIES: Record<string, Bilingual> = {
  parking: { en: "Parking", ar: "مواقف سيارات" },
  prayer_room: { en: "Prayer room", ar: "مصلى" },
  family_section: { en: "Family section", ar: "قسم عائلات" },
  outdoor_seating: { en: "Outdoor seating", ar: "جلسات خارجية" },
  wifi: { en: "Wi-Fi", ar: "واي فاي" },
  restrooms: { en: "Restrooms", ar: "دورات مياه" },
  kids_area: { en: "Kids' area", ar: "منطقة أطفال" },
  delivery: { en: "Delivery", ar: "توصيل" },
  reservations: { en: "Takes reservations", ar: "يقبل الحجوزات" },
  food_court: { en: "Food court", ar: "ساحة مطاعم" },
  cinema: { en: "Cinema", ar: "سينما" },
  lockers: { en: "Lockers", ar: "خزائن" },
  shade: { en: "Shaded areas", ar: "مناطق مظللة" },
  walking_track: { en: "Walking track", ar: "مسار مشي" },
  playground: { en: "Playground", ar: "ألعاب أطفال" },
};
