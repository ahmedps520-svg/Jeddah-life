import { normalizeText, stripArabicArticle, skeletons } from "./normalize";

/**
 * Rule-based natural-language query parser (English + Arabic).
 *
 * Turns "indoor activities under 100 SAR" or "مقاهي رخيصه قريبه من البحر"
 * into structured filters plus the leftover words for text matching.
 * It is deliberately transparent: every rule that fired is reported back
 * so the UI can show what was understood and let the user remove it.
 *
 * Matching happens on normalised text where each Arabic word has had its
 * definite article removed, so Arabic phrases below are written without
 * "ال" (e.g. "كورنيش", "واجهه بحريه").
 */

export type Attr = "family" | "indoor" | "outdoor" | "groups" | "photo" | "romantic" | "quiet" | "wheelchair" | "late";
export type When = { kind: "tonight" | "today" | "weekend" | "day"; weekday?: number };

export type Understood =
  | { kind: "category"; value: string }
  | { kind: "sub"; value: string }
  | { kind: "maxPrice"; value: number }
  | { kind: "free" }
  | { kind: "upscale" }
  | { kind: "openNow" }
  | { kind: "when"; value: When }
  | { kind: "attr"; value: Attr }
  | { kind: "occasion"; value: string }
  | { kind: "hood"; value: string }
  | { kind: "waterfront" }
  | { kind: "nearMe" }
  | { kind: "activities" };

export type ParsedQuery = {
  raw: string;
  text: string[];
  categories: string[];
  subs: string[];
  maxPrice: number | null;
  free: boolean;
  minLevel: number | null;
  openNow: boolean;
  when: When | null;
  attrs: Attr[];
  occasions: string[];
  hoods: string[];
  waterfront: boolean;
  nearMe: boolean;
  activities: boolean;
  understood: Understood[];
};

type Apply = (q: ParsedQuery, m: RegExpExecArray) => void;
type Rule = { re: RegExp; apply: Apply };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word phrase rule: any of the phrases, bounded by spaces. */
function words(phrases: string[], apply: Apply): Rule {
  const alts = phrases
    .map((p) => p.split(" ").map((w) => esc(stripArabicArticle(normalizeText(w)))).join(" "))
    .sort((a, b) => b.length - a.length)
    .join("|");
  return { re: new RegExp(`(?<= )(?:${alts})(?= )`, "gu"), apply };
}

/** Custom regex rule (for numbers). The source is bounded by spaces. */
function pattern(source: string, apply: Apply): Rule {
  return { re: new RegExp(`(?<= )(?:${source})(?= )`, "gu"), apply };
}

const addCat = (q: ParsedQuery, c: string, report = true) => {
  if (!q.categories.includes(c)) {
    q.categories.push(c);
    if (report) q.understood.push({ kind: "category", value: c });
  }
};
const cat = (c: string): Apply => (q) => addCat(q, c);
const sub = (s: string, c: string): Apply => (q) => {
  if (!q.subs.includes(s)) {
    q.subs.push(s);
    q.understood.push({ kind: "sub", value: s });
  }
  addCat(q, c, false);
};
const attr = (a: Attr): Apply => (q) => {
  if (!q.attrs.includes(a)) {
    q.attrs.push(a);
    q.understood.push({ kind: "attr", value: a });
  }
};
const occasion = (o: string): Apply => (q) => {
  if (!q.occasions.includes(o)) {
    q.occasions.push(o);
    q.understood.push({ kind: "occasion", value: o });
  }
};
const when = (w: When): Apply => (q) => {
  q.understood = q.understood.filter((u) => u.kind !== "when");
  q.when = w;
  q.understood.push({ kind: "when", value: w });
};
const price = (n: number): Apply => (q) => {
  if (!Number.isFinite(n) || n <= 0) return;
  q.maxPrice = q.maxPrice == null ? n : Math.min(q.maxPrice, n);
  q.understood = q.understood.filter((u) => u.kind !== "maxPrice");
  q.understood.push({ kind: "maxPrice", value: q.maxPrice });
};
const flag = (k: "free" | "openNow" | "waterfront" | "nearMe" | "activities"): Apply => (q) => {
  if (q[k]) return;
  q[k] = true;
  q.understood.push({ kind: k });
};

const CURRENCY = "(?:sar|sr|riyals?|rs|ريال|ريالات|رس|ر س)";

const RULES: Rule[] = [
  // Price
  pattern(`(?:under|below|less than|max|up to|within|cheaper than)\\s+(\\d{1,5})(?:\\s+${CURRENCY})?`, (q, m) => price(Number(m[1]))(q, m)),
  pattern(`(?:اقل من|باقل من|تحت|حدود|بحدود|ما يتجاوز|لا يتجاوز|ما يزيد عن)\\s+(\\d{1,5})(?:\\s+${CURRENCY})?`, (q, m) => price(Number(m[1]))(q, m)),
  pattern(`(\\d{1,5})\\s+${CURRENCY}`, (q, m) => price(Number(m[1]))(q, m)),
  words(["free", "no cost", "without paying", "free entry", "مجاني", "مجانيه", "مجانا", "ببلاش", "بلاش", "بدون فلوس"], flag("free")),
  words(
    ["cheap", "cheapest", "affordable", "budget", "inexpensive", "low cost", "رخيص", "رخيصه", "اقتصادي", "اقتصاديه", "على قد الحال", "سعر معقول", "اسعار معقوله"],
    price(40),
  ),
  words(["luxury", "luxurious", "fancy", "fine dining", "upscale", "high end", "premium", "فاخر", "فاخره", "راقي", "راقيه", "فخم", "فخمه"], (q) => {
    q.minLevel = 3;
    q.understood.push({ kind: "upscale" });
  }),

  // Time
  words(["tonight", "this evening", "evening", "night", "الليله", "هالليله", "ليل", "مسا", "مساء"], when({ kind: "tonight" })),
  words(["open now", "right now", "now", "مفتوح الحين", "مفتوح الان", "الحين", "الان", "حاليا"], flag("openNow")),
  words(["this weekend", "weekend", "ويكند", "نهايه اسبوع", "اخر اسبوع"], when({ kind: "weekend" })),
  words(["friday", "on friday", "جمعه", "يوم جمعه"], when({ kind: "day", weekday: 5 })),
  words(["saturday", "on saturday", "سبت", "يوم سبت"], when({ kind: "day", weekday: 6 })),
  words(["thursday", "on thursday", "خميس", "يوم خميس"], when({ kind: "day", weekday: 4 })),
  words(["today", "اليوم"], (q, m) => {
    if (!q.when) when({ kind: "today" })(q, m);
  }),

  // Location
  words(
    [
      "waterfront", "near the waterfront", "corniche", "seafront", "sea front", "by the sea", "sea view", "seaside", "near the sea",
      "on the sea", "beachfront", "واجهه بحريه", "كورنيش", "على بحر", "قريب من بحر", "قريبه من بحر", "جنب بحر", "مطل على بحر", "اطلاله بحريه",
    ],
    flag("waterfront"),
  ),
  words(["near me", "nearby", "close to me", "around me", "closest", "قريب مني", "قريبه مني", "حولي", "جنبي", "اقرب"], flag("nearMe")),

  // Who & occasions
  words(["birthday", "bday", "celebration", "celebrate", "عيد ميلاد", "حفله", "لحفله", "احتفال", "نحتفل"], (q, m) => {
    occasion("birthday")(q, m);
    attr("groups")(q, m);
  }),
  words(["date night", "date", "romantic", "for two", "couple", "couples", "رومانسي", "رومانسيه", "لشخصين", "انا وزوجتي", "انا وزوجي"], (q, m) => {
    attr("romantic")(q, m);
    occasion("date")(q, m);
  }),
  words(
    ["with friends", "friends", "mates", "squad", "group", "gang", "guys", "girls", "اصدقاء", "اصحاب", "شباب", "بنات", "شله", "ربع", "خوياي", "قروب", "مجموعه"],
    attr("groups"),
  ),
  words(
    [
      "family friendly", "kid friendly", "kids friendly", "child friendly", "children friendly", "good for kids", "suitable for kids",
      "family", "families", "kids", "children", "child", "toddler", "toddlers",
      "مناسب للعائلات", "مناسب للاطفال", "عائله", "عائلي", "عائليه", "اطفال", "اولاد", "عيال", "بزران",
    ],
    attr("family"),
  ),

  // Attributes
  words(["indoor", "indoors", "inside", "air conditioned", "داخلي", "داخليه", "مكيف", "مكيفه"], attr("indoor")),
  words(["outdoor", "outdoors", "outside", "open air", "fresh air", "خارجي", "خارجيه", "في هواء طلق", "برا"], attr("outdoor")),
  words(
    ["photos", "photo", "photography", "pictures", "instagram", "instagrammable", "photogenic", "take photos", "تصوير", "للتصوير", "صور", "انستقرام"],
    attr("photo"),
  ),
  words(["quiet", "calm", "peaceful", "chill", "relax", "relaxing", "study", "هادي", "هادئ", "هاديه", "هادئه", "رايق", "رايقه", "روقان", "استرخاء", "مذاكره"], attr("quiet")),
  words(["wheelchair", "accessible", "accessibility", "كرسي متحرك", "ذوي اعاقه", "ذوي همم"], attr("wheelchair")),
  words(["late night", "open late", "after midnight", "nightlife", "night out", "سهر", "سهره", "سهرات", "لوقت متاخر", "بعد منتصف ليل"], attr("late")),

  // Activities ("things to do")
  words(
    [
      "things to do", "what to do", "activities", "activity", "something fun", "fun things", "outing", "hang out", "hangout", "places to go",
      "اشياء نسويها", "وش نسوي", "ايش نسوي", "انشطه", "نشاط", "طلعه", "طلعات", "وين نروح", "مشوار",
    ],
    flag("activities"),
  ),

  // Food sub-types
  words(["ice cream", "icecream", "gelato", "frozen yogurt", "frozen yoghurt", "ايس كريم", "ايسكريم", "بوظه", "جيلاتو"], sub("ice_cream", "cafes")),
  words(
    ["dessert", "desserts", "sweets", "cake", "cakes", "donut", "donuts", "doughnut", "doughnuts", "bakery", "pastry", "pastries", "chocolate", "حلويات", "حلا", "كيك", "دونات", "مخبز", "مخبوزات", "شوكولاته"],
    sub("dessert", "cafes"),
  ),
  words(["brunch", "breakfast", "فطور", "افطار", "برنش"], sub("breakfast", "restaurants")),
  words(["seafood", "fish", "shrimp", "prawns", "ماكولات بحريه", "سمك", "اسماك", "روبيان", "سيفود"], sub("seafood", "restaurants")),
  words(["burger", "burgers", "برجر", "برقر"], sub("burger", "restaurants")),
  words(["pizza", "بيتزا"], sub("pizza", "restaurants")),
  words(["sushi", "japanese", "سوشي", "ياباني"], sub("japanese", "restaurants")),
  words(["italian", "pasta", "ايطالي", "باستا"], sub("italian", "restaurants")),
  words(["indian", "biryani", "هندي", "برياني"], sub("indian", "restaurants")),
  words(
    ["lebanese", "syrian", "arabic food", "arabian", "shawarma", "middle eastern", "mandi", "kabsa", "لبناني", "سوري", "شاورما", "مندي", "كبسه", "مظبي", "شعبي"],
    sub("arab", "restaurants"),
  ),
  words(["steak", "steakhouse", "grill", "grills", "bbq", "barbecue", "ستيك", "مشويات", "مشاوي"], sub("grill", "restaurants")),
  words(["fast food", "quick bite", "takeaway", "وجبات سريعه"], sub("fast_food", "restaurants")),

  // Categories
  words(
    ["specialty coffee", "speciality coffee", "coffee", "cafe", "cafes", "coffee shop", "coffee shops", "espresso", "latte", "قهوه", "قهوه مختصه", "مقهى", "مقاهي", "كافيه", "كافيهات", "كوفي", "كافي"],
    cat("cafes"),
  ),
  words(["restaurant", "restaurants", "food", "eat", "eating", "dinner", "lunch", "dine", "dining", "meal", "مطعم", "مطاعم", "اكل", "عشاء", "غداء", "غدا", "عشا", "وجبه"], cat("restaurants")),
  words(["cinema", "cinemas", "movie", "movies", "film", "films", "imax", "سينما", "سينمات", "فيلم", "افلام"], sub("cinema", "entertainment")),
  words(
    ["escape room", "escape rooms", "bowling", "arcade", "games", "gaming", "video games", "billiards", "karaoke", "comedy", "غرف هروب", "غرفه هروب", "بولينج", "بولينغ", "العاب", "قيمز", "بلياردو", "كوميدي"],
    sub("games", "entertainment"),
  ),
  words(["theme park", "theme parks", "amusement park", "rides", "water park", "waterpark", "aquarium", "ملاهي", "مدينه العاب", "حديقه مائيه", "احواض"], (q, m) => {
    cat("family")(q, m);
    addCat(q, "entertainment", false);
  }),
  words(["entertainment", "fun", "ترفيه", "وناسه", "ممتع", "ممتعه"], cat("entertainment")),
  words(
    ["diving", "dive", "scuba", "snorkel", "snorkeling", "snorkelling", "horse riding", "horseback", "horses", "karting", "go kart", "go karts", "drift", "trampoline", "climbing", "adventure", "adventures", "extreme",
      "غوص", "سنوركل", "ركوب خيل", "خيل", "كارتينج", "درفت", "ترامبولين", "تسلق", "مغامره", "مغامرات"],
    cat("adventure"),
  ),
  words(["sport", "sports", "padel", "football", "soccer", "tennis", "stadium", "match", "رياضه", "رياضي", "بادل", "كوره", "كره قدم", "ملعب", "مباراه", "تنس"], cat("sports")),
  words(["beach", "beaches", "swim", "swimming", "sea", "sand", "شاطئ", "شواطئ", "شاطي", "بحر", "سباحه", "بلاج"], cat("beaches")),
  words(["park", "parks", "garden", "gardens", "walk", "walking", "promenade", "stroll", "picnic", "حديقه", "حدائق", "منتزه", "ممشى", "مشي", "نزهه", "كشته"], cat("outdoors")),
  words(["mall", "malls", "shopping", "shop", "shops", "souq", "souqs", "souk", "souks", "market", "markets", "boutique", "boutiques", "مول", "مولات", "تسوق", "سوق", "اسواق", "محلات"], cat("shopping")),
  words(
    ["museum", "museums", "history", "historic", "historical", "heritage", "culture", "cultural", "old town", "art", "arts", "gallery", "galleries", "exhibition", "exhibitions", "architecture",
      "متحف", "متاحف", "تاريخ", "تاريخي", "تاريخيه", "تراث", "ثقافه", "ثقافي", "فن", "فنون", "معرض", "معارض", "عماره"],
    cat("culture"),
  ),
];

const STOPWORDS = new Set(
  [
    "in", "at", "on", "the", "a", "an", "for", "with", "to", "of", "and", "or", "some", "any", "good", "best", "great", "nice", "cool",
    "places", "place", "spots", "spot", "jeddah", "jedda", "jidda", "city", "me", "my", "us", "we", "our", "i", "want", "looking",
    "find", "show", "where", "can", "go", "do", "is", "are", "around", "near", "this", "that", "something", "somewhere", "lets",
    "let", "please", "also", "very", "really", "take", "visit", "worth", "things", "thing", "spend",
    "في", "من", "مع", "على", "الى", "او", "و", "عن", "ابي", "ابغى", "ابغا", "ودي", "نبي", "نبغى", "ابحث", "مكان", "اماكن", "محل",
    "جده", "جدة", "حلو", "حلوه", "زين", "افضل", "احسن", "فيه", "شي", "شيء", "عشان", "لنا", "لي", "اللي", "هذا", "هذي", "وين", "قريب", "قريبه",
  ].map((w) => stripArabicArticle(normalizeText(w))),
);

export type HoodVocab = { slug: string; tokens: string[][]; skeletons: string[] };

export function emptyQuery(raw = ""): ParsedQuery {
  return {
    raw,
    text: [],
    categories: [],
    subs: [],
    maxPrice: null,
    free: false,
    minLevel: null,
    openNow: false,
    when: null,
    attrs: [],
    occasions: [],
    hoods: [],
    waterfront: false,
    nearMe: false,
    activities: false,
    understood: [],
  };
}

export function parseQuery(raw: string, hoodVocab: HoodVocab[] = []): ParsedQuery {
  const q = emptyQuery(raw);
  const tokens0 = normalizeText(raw).split(" ").filter(Boolean).map(stripArabicArticle);
  let s = ` ${tokens0.join(" ")} `;

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let hit = false;
    while ((m = rule.re.exec(s))) {
      rule.apply(q, m);
      hit = true;
    }
    if (hit) {
      rule.re.lastIndex = 0;
      s = s.replace(rule.re, " ");
      s = ` ${s.trim().replace(/\s+/g, " ")} `;
    }
  }

  // Neighbourhoods: match whole names (multi-word) on the remaining words.
  let tokens = s.trim().split(" ").filter(Boolean);
  for (const h of hoodVocab) {
    outer: for (const nameTokens of h.tokens) {
      if (!nameTokens.length) continue;
      for (let i = 0; i + nameTokens.length <= tokens.length; i++) {
        const win = tokens.slice(i, i + nameTokens.length);
        const exact = win.every((t, k) => t === nameTokens[k]);
        const fuzzy = nameTokens.length === 1 && win[0].length >= 4 && skeletons(win[0]).some((sk) => h.skeletons.includes(sk));
        if (exact || fuzzy) {
          if (!q.hoods.includes(h.slug)) {
            q.hoods.push(h.slug);
            q.understood.push({ kind: "hood", value: h.slug });
          }
          tokens = [...tokens.slice(0, i), ...tokens.slice(i + nameTokens.length)];
          break outer;
        }
      }
    }
  }

  q.text = tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1 && !/^\d+$/.test(t));
  return q;
}
