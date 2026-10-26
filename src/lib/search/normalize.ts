/**
 * Text normalisation for bilingual search.
 *
 * - Arabic: strips diacritics and tatweel, unifies alef/hamza/yaa/taa
 *   marbuta forms, drops the definite article "ال" from longer words.
 * - Latin: lower-cases, removes accents and the "al-/el-/ash-" articles.
 * - Both scripts can be reduced to a consonant "skeleton" so that common
 *   transliterations meet in the middle: "Obhur", "Abhur" and "أبحر" all
 *   become "bhr"; "Al-Shati", "Ash Shatee" and "الشاطئ" become "St".
 */

const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_DIGITS.indexOf(d);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(d));
  });
}

export function normalizeArabic(s: string): string {
  return s
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ڤ/g, "ف")
    .replace(/[گ]/g, "ك")
    .replace(/[ـ]/g, "");
}

const LATIN_ARTICLES = /\b(al|el|ar|as|ash|at|ad|adh|an|az)[\s-]+(?=\w)/g;

export function normalizeText(input: string): string {
  let s = normalizeDigits(input.toLowerCase());
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  s = normalizeArabic(s);
  s = s.replace(/['’`ʻʿ]/g, "");
  s = s.replace(LATIN_ARTICLES, "");
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return s;
}

/** Words where "ال" is part of the word, not an article. */
const KEEP_ARTICLE = new Set(["الان", "اليوم", "الليله", "الحين", "اللي", "الي", "الا", "الله"]);

/** Strip the Arabic definite article and common attached prepositions. */
export function stripArabicArticle(token: string): string {
  if (!/[؀-ۿ]/.test(token) || token.length <= 3 || KEEP_ARTICLE.has(token)) return token;
  for (const prefix of ["وال", "بال", "فال", "كال", "لل", "ال"]) {
    if (token.startsWith(prefix) && token.length - prefix.length >= 2) return token.slice(prefix.length);
  }
  return token;
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .filter(Boolean)
    .map(stripArabicArticle);
}

const AR_TO_LATIN: Record<string, string> = {
  ا: "",
  ب: "b",
  ت: "t",
  ث: "T",
  ج: "j",
  ح: "h",
  خ: "K",
  د: "d",
  ذ: "T",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "S",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "",
  غ: "G",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ء: "",
};

/**
 * Consonant skeletons for cross-script fuzzy matching. Two variants are
 * returned — with and without w/y — because Arabic writes long vowels with
 * و/ي while Latin transliterations write them as vowels. Skeletons shorter
 * than three characters are dropped as too ambiguous.
 */
export function skeletons(token: string): string[] {
  let s: string;
  if (/[؀-ۿ]/.test(token)) {
    s = [...stripArabicArticle(normalizeArabic(token))].map((c) => AR_TO_LATIN[c] ?? "").join("");
  } else {
    s = token
      .toLowerCase()
      .replace(/sh/g, "S")
      .replace(/kh/g, "K")
      .replace(/th|dh/g, "T")
      .replace(/gh/g, "G")
      .replace(/g/g, "q")
      .replace(/c/g, "k")
      .replace(/[aeiou]/g, "");
  }
  const tidy = (v: string) => v.replace(/(.)\1+/g, "$1").replace(/h$/, "");
  const withWY = tidy(s);
  const withoutWY = tidy(s.replace(/(?<=.)[wy]/g, ""));
  return [...new Set([withWY, withoutWY])].filter((v) => v.length >= 3);
}
