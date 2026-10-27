import { describe, expect, it } from "vitest";
import { cityWallAt, isValidHours, openDuring, openStatus, opensLate } from "@/lib/places/hours";

describe("opening hours", () => {
  const hours = "Sa-Th 08:00-23:00; Fr 16:00-01:00";

  it("validates OSM opening_hours strings", () => {
    expect(isValidHours(hours)).toBe(true);
    expect(isValidHours("whenever we like")).toBe(false);
  });

  it("reports listed open and closed states at a given Jeddah time", () => {
    // 2026-10-27 is a Tuesday.
    expect(openStatus(hours, cityWallAt("2026-10-27", "10:00"))?.state).toBe("open");
    expect(openStatus(hours, cityWallAt("2026-10-27", "23:30"))?.state).toBe("closed");
    // Friday morning before 4 pm.
    expect(openStatus(hours, cityWallAt("2026-10-30", "11:00"))?.state).toBe("closed");
  });

  it("returns null when no hours are listed", () => {
    expect(openStatus(null)).toBeNull();
    expect(openDuring(undefined, cityWallAt("2026-10-27", "10:00"), 60)).toBeNull();
  });

  it("checks a whole visit window", () => {
    expect(openDuring(hours, cityWallAt("2026-10-27", "21:00"), 90)).toBe(true);
    expect(openDuring(hours, cityWallAt("2026-10-27", "22:30"), 90)).toBe(false);
  });

  it("detects late opening", () => {
    expect(opensLate(hours)).toBe(true);
    expect(opensLate("Mo-Su 09:00-17:00")).toBe(false);
  });
});
