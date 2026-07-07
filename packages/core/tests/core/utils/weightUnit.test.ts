import { convertWeight, formatWeight } from "@src/core";

describe("weightUnit", () => {
  describe("convertWeight", () => {
    it("returns the input unchanged when from and to units match", () => {
      expect(convertWeight(316.25, "lbs", "lbs")).toBe(316.25);
      expect(convertWeight(143.5, "kg", "kg")).toBe(143.5);
    });

    it("converts lbs to kg at full precision", () => {
      expect(convertWeight(1, "lbs", "kg")).toBeCloseTo(0.45359237, 8);
      expect(convertWeight(315, "lbs", "kg")).toBeCloseTo(142.8815966, 6);
    });

    it("converts kg to lbs at full precision", () => {
      expect(convertWeight(100, "kg", "lbs")).toBeCloseTo(220.462262185, 6);
    });

    it("round-trips lbs -> kg -> lbs without drift beyond floating-point noise", () => {
      const original = 316.25;
      const roundTripped = convertWeight(
        convertWeight(original, "lbs", "kg"),
        "kg",
        "lbs",
      );
      expect(roundTripped).toBeCloseTo(original, 9);
    });
  });

  describe("formatWeight", () => {
    it("formats a converted weight rounded to 2 decimal places with the target unit suffix", () => {
      expect(formatWeight(315, "lbs", "kg")).toBe("142.88 kg");
      expect(formatWeight(100, "kg", "lbs")).toBe("220.46 lbs");
    });

    it("does not convert or round when from and to units match", () => {
      expect(formatWeight(316.25, "lbs", "lbs")).toBe("316.25 lbs");
    });
  });
});
