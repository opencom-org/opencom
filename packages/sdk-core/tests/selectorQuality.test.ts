import { describe, expect, it } from "vitest";
import { scoreSelectorQuality } from "../src/utils/selectorQuality";

describe("selectorQuality", () => {
  it("scores stable selectors as good", () => {
    const result = scoreSelectorQuality('[data-tooltip-target="save-button"]', {
      matchCount: 1,
    });

    expect(result.grade).toBe("good");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.warnings).toEqual([]);
  });

  it("flags non-unique selectors", () => {
    const result = scoreSelectorQuality(".button", { matchCount: 3 });

    expect(result.grade).not.toBe("good");
    expect(result.warnings.join(" ")).toMatch(/matches 3 elements/i);
  });

  it("flags fragile positional selectors", () => {
    const result = scoreSelectorQuality("main > div:nth-of-type(2) > span");

    expect(result.grade).not.toBe("good");
    expect(result.warnings.join(" ")).toMatch(/positional matching/i);
  });
});
