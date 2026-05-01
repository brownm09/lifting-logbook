import { estimateTrainingMax } from "@src/core";

describe("estimateTrainingMax", () => {
  it("estimates TM from (225, 5) using Brzycki formula rounded to nearest 5", () => {
    // 1RM = 225 / (1.0278 - 0.0278 * 5) = 225 / 0.8888 ≈ 253.2 → rounds to 255
    expect(estimateTrainingMax(225, 5)).toBe(255);
  });

  it("returns input weight for a single rep", () => {
    expect(estimateTrainingMax(315, 1)).toBe(315);
  });

  it("rounds to nearest 5", () => {
    // 200 / (1.0278 - 0.0278 * 3) = 200 / 0.9444 ≈ 211.8 → rounds to 210
    expect(estimateTrainingMax(200, 3) % 5).toBe(0);
  });

  it("throws RangeError for reps = 0", () => {
    expect(() => estimateTrainingMax(200, 0)).toThrow(RangeError);
  });

  it("throws RangeError for reps = 37", () => {
    expect(() => estimateTrainingMax(200, 37)).toThrow(RangeError);
  });

  it("accepts reps = 36 without throwing", () => {
    expect(() => estimateTrainingMax(100, 36)).not.toThrow();
  });
});
