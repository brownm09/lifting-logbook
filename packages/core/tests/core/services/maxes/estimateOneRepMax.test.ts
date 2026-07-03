import { estimateOneRepMax } from "@src/core";

describe("estimateOneRepMax", () => {
  it("floors the weight to the nearest 2.5 for a single rep", () => {
    expect(estimateOneRepMax(225, 1)).toBe(225);
    expect(estimateOneRepMax(225.4, 1)).toBe(225);
    // Distinguishes floor-to-2.5 from round-to-nearest: 203 rounds to 203 but
    // floors to 202.5.
    expect(estimateOneRepMax(203, 1)).toBe(202.5);
  });

  it("estimates a higher 1RM for multi-rep sets, floored to the nearest 2.5", () => {
    // 200 × 5 → 200 × 36 / 32 = 225 (already an exact multiple of 2.5)
    expect(estimateOneRepMax(200, 5)).toBe(225);
    // 210 × 3 → 210 × 36 / 34 = 222.35... rounds to 222 but floors to 220.
    expect(estimateOneRepMax(210, 3)).toBe(220);
  });

  it("returns 0 for non-positive weight or reps", () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(200, 0)).toBe(0);
    expect(estimateOneRepMax(-10, 5)).toBe(0);
    expect(estimateOneRepMax(200, -3)).toBe(0);
  });

  it("returns 0 at and beyond the formula asymptote (reps ≥ 37)", () => {
    expect(estimateOneRepMax(200, 37)).toBe(0);
    expect(estimateOneRepMax(200, 40)).toBe(0);
  });
});
