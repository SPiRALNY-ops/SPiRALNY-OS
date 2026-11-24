import { describe, expect, it } from "vitest";
import { formatShare, plural, wholePercents } from "./format";

describe("formatShare", () => {
  it("never shows a real, tiny share as 0%", () => {
    expect(formatShare(1 / 248)).toBe("<1%");
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(0.5)).toBe("50%");
    expect(formatShare(0.005)).toBe("1%");
  });
});

describe("wholePercents", () => {
  it("adds up to exactly 100", () => {
    expect(wholePercents([1, 7])).toEqual([13, 87]);
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([2, 0, 1, 5])).toEqual([25, 0, 13, 62]);
    for (const set of [[3, 3, 3, 3, 3, 3, 3], [181, 56, 5, 4, 3, 1], [1, 999]]) {
      expect(wholePercents(set).reduce((s, v) => s + v, 0)).toBe(100);
    }
  });
  it("is all zeros when there is nothing", () => {
    expect(wholePercents([0, 0])).toEqual([0, 0]);
  });
});

describe("plural", () => {
  it("uses the singular only for one", () => {
    expect(plural(1, "row", "rows")).toBe("1 row");
    expect(plural(0, "row", "rows")).toBe("0 rows");
    expect(plural(1415, "row", "rows")).toBe("1,415 rows");
  });
});
