import { describe, expect, it } from "vitest";
import { parseQuery } from "@/lib/search/parse";
import { buildHoodVocab } from "@/lib/search/hood-vocab";

const vocab = buildHoodVocab([
  { slug: "al-hamra", nameEn: "Al-Hamra", nameAr: "الحمراء" },
  { slug: "abhur-ash-shamaliyah", nameEn: "North Obhur", nameAr: "أبحر الشمالية" },
  { slug: "al-balad", nameEn: "Al-Balad (Historic Jeddah)", nameAr: "البلد" },
]);

describe("parseQuery (English)", () => {
  it("understands category, price and waterfront", () => {
    const q = parseQuery("cheap coffee near the waterfront", vocab);
    expect(q.categories).toEqual(["cafes"]);
    expect(q.maxPrice).not.toBeNull();
    expect(q.waterfront).toBe(true);
    expect(q.text).toEqual([]);
  });

  it("reads an explicit budget and consumes 'family friendly'", () => {
    const q = parseQuery("family friendly things to do under 100 SAR", vocab);
    expect(q.maxPrice).toBe(100);
    expect(q.attrs).toContain("family");
    expect(q.activities).toBe(true);
    expect(q.text).toEqual([]);
  });

  it("recognises occasions and time", () => {
    const q = parseQuery("romantic dinner for a date tonight", vocab);
    expect(q.categories).toContain("restaurants");
    expect(q.occasions).toContain("date");
    expect(q.attrs).toContain("romantic");
    expect(q.when).toEqual({ kind: "tonight" });
  });

  it("finds neighbourhoods by alias", () => {
    expect(parseQuery("breakfast in obhur", vocab).hoods).toEqual(["abhur-ash-shamaliyah"]);
  });

  it("handles free and open now", () => {
    const q = parseQuery("free places open now", vocab);
    expect(q.free).toBe(true);
    expect(q.openNow).toBe(true);
  });
});

describe("parseQuery (Arabic)", () => {
  it("understands a cheap restaurant in an area", () => {
    const q = parseQuery("مطعم رخيص في الحمراء", vocab);
    expect(q.categories).toEqual(["restaurants"]);
    expect(q.maxPrice).not.toBeNull();
    expect(q.hoods).toEqual(["al-hamra"]);
  });

  it("reads budgets written as باقل من", () => {
    const q = parseQuery("كافيه هادئ باقل من 50 ريال", vocab);
    expect(q.categories).toEqual(["cafes"]);
    expect(q.maxPrice).toBe(50);
    expect(q.attrs).toContain("quiet");
  });

  it("understands 'suitable for families'", () => {
    expect(parseQuery("مكان مناسب للعائلات", vocab).attrs).toContain("family");
  });

  it("keeps unknown words (like brand names) as text to match", () => {
    expect(parseQuery("ستاربكس", vocab).text).toEqual(["ستاربكس"]);
  });
});
