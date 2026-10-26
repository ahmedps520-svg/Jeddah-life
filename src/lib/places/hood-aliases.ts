/**
 * Display-name overrides and common spellings for neighbourhoods.
 * OSM names are kept in the database; these make the familiar spellings
 * (and transliteration variants people actually type) work in search.
 */
export const HOOD_DISPLAY: Record<string, { en?: string; ar?: string }> = {
  "al-shatee": { en: "Ash Shati" },
  "abhur-ash-shamaliyah": { en: "North Obhur", ar: "أبحر الشمالية" },
  "abhur-al-janubiyah": { en: "South Obhur", ar: "أبحر الجنوبية" },
  "al-hamra": { en: "Al-Hamra" },
  "al-rawdah": { en: "Al-Rawdah" },
  "al-zahra": { en: "Al-Zahra" },
  "al-safa": { en: "Al-Safa" },
  "al-balad": { en: "Al-Balad (Historic Jeddah)", ar: "البلد (جدة التاريخية)" },
  "al-andalus": { en: "Al-Andalus" },
  "al-khalidiyyah": { en: "Al-Khalidiyah" },
  "al-faisaliyyah": { en: "Al-Faisaliyah" },
  "al-aziziyah": { en: "Al-Aziziyah" },
  "al-naeem": { en: "Al-Naeem" },
  "al-mohammadiyah": { en: "Al-Mohammadiyah" },
  "al-murjaan": { en: "Al-Murjan" },
  "ar-ruwais": { en: "Al-Ruwais" },
  "ash-sharafiyah": { en: "Al-Sharafiyah" },
  "al-bawadi": { en: "Al-Bawadi" },
  "al-nuzha": { en: "Al-Nuzhah" },
};

export const HOOD_ALIASES: Record<string, string[]> = {
  "al-shatee": ["shati", "shatee", "shatea", "shatie", "ash shati", "al shati", "shatei", "شاطئ", "شاطي"],
  "abhur-ash-shamaliyah": ["obhur", "abhur", "obhor", "north obhur", "obhur north", "obhur shamaliyah", "ابحر", "ابحر شماليه", "شمال ابحر"],
  "abhur-al-janubiyah": ["south obhur", "obhur south", "obhur janubiyah", "ابحر جنوبيه", "جنوب ابحر"],
  "al-hamra": ["hamra", "hamraa", "hamrah", "حمراء", "حمرا"],
  "al-rawdah": ["rawdah", "rawda", "rowdah", "rawdha", "روضه"],
  "al-zahra": ["zahra", "zahraa", "zahrah", "zahraa", "زهراء", "زهرا"],
  "al-safa": ["safa", "safaa", "صفا"],
  "al-balad": ["balad", "old jeddah", "historic jeddah", "historical jeddah", "jeddah historic district", "old town", "بلد", "جده تاريخيه", "جده قديمه"],
  "al-andalus": ["andalus", "andalous", "اندلس"],
  "al-khalidiyyah": ["khalidiya", "khalidiyah", "khalidiyyah", "خالديه"],
  "al-salamah": ["salamah", "salama", "سلامه"],
  "al-naeem": ["naeem", "naim", "nuaim", "نعيم"],
  "al-nahdah": ["nahda", "nahdah", "نهضه"],
  "al-mohammadiyah": ["mohammadiyah", "muhammadiyah", "mohammadiya", "محمديه"],
  "al-murjaan": ["murjan", "marjan", "murjaan", "مرجان"],
  "ar-ruwais": ["ruwais", "rowais", "رويس"],
  "al-faisaliyyah": ["faisaliyah", "faisaliya", "فيصليه"],
  "al-aziziyah": ["aziziyah", "aziziya", "عزيزيه"],
  "ash-sharafiyah": ["sharafiyah", "sharafia", "sharafiya", "شرفيه"],
  "al-bawadi": ["bawadi", "بوادي"],
  "al-nuzha": ["nuzha", "nuzhah", "نزهه"],
  "al-baghdadiyah-al-gharbiyah": ["baghdadiyah", "بغداديه"],
};

/** Neighbourhoods presented as destination guides, in display order. */
export const FEATURED_HOODS = [
  "al-balad",
  "al-hamra",
  "al-shatee",
  "al-rawdah",
  "al-zahra",
  "abhur-ash-shamaliyah",
  "al-safa",
  "al-andalus",
  "abhur-al-janubiyah",
];
