import { describe, expect, it } from "vitest";
import { costEstimate, haversineKm, travelEstimate } from "@/lib/places/estimates";

describe("costEstimate", () => {
  it("prefers verified prices", () => {
    const c = costEstimate({ category: "culture", subcategory: "museum", priceMin: 25, priceMax: 25 });
    expect(c).toMatchObject({ min: 25, max: 25, basis: "verified" });
  });

  it("treats a verified 0 price as free", () => {
    expect(costEstimate({ category: "culture", subcategory: "museum", priceMin: 0, priceMax: 0 }).basis).toBe("free");
  });

  it("uses free entry when the place is marked free", () => {
    const c = costEstimate({ category: "outdoors", subcategory: "park", priceMin: null, priceMax: null, attributes: { free: { value: true } } });
    expect(c).toMatchObject({ planning: 0, basis: "free" });
  });

  it("estimates food and drink from typical spend, labelled as an estimate", () => {
    const c = costEstimate({ category: "cafes", subcategory: "coffee_shop", priceMin: null, priceMax: null });
    expect(c.basis).toBe("estimate");
    expect(c.min).toBeGreaterThan(0);
    expect(c.planning).toBeGreaterThanOrEqual(c.min!);
    expect(c.planning).toBeLessThanOrEqual(c.max!);
  });

  it("never invents a price for an activity without one", () => {
    const c = costEstimate({ category: "entertainment", subcategory: "escape_room", priceMin: null, priceMax: null });
    expect(c.basis).toBe("unknown");
    expect(c.planning).toBeNull();
  });
});

describe("distances", () => {
  const corniche = { lat: 21.5433, lng: 39.1728 };
  const balad = { lat: 21.4858, lng: 39.1925 };

  it("computes great-circle distance", () => {
    expect(haversineKm(corniche, balad)).toBeGreaterThan(6);
    expect(haversineKm(corniche, balad)).toBeLessThan(7);
  });

  it("adds a detour factor and is slower on foot", () => {
    const car = travelEstimate(corniche, balad, "car");
    const walk = travelEstimate(corniche, balad, "walk");
    expect(car.km).toBeGreaterThan(haversineKm(corniche, balad));
    expect(walk.minutes).toBeGreaterThan(car.minutes);
    expect(car.basis).toBe("estimate");
  });
});
