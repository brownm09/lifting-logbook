import { convertWeight, formatWeight, roundToDisplay } from "@src/core";

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

    it("does not convert or round a directly-known value shown in its own unit", () => {
      // A >2-decimal training max (0.625 plate increment) must render at full
      // precision when displayed in its stored unit — see
      // docs/standards/training-max-precision.md category 1. Uses a 3-decimal
      // fixture so a reintroduced same-unit round() would fail this assertion.
      expect(formatWeight(316.875, "lbs", "lbs")).toBe("316.875 lbs");
      expect(formatWeight(142.881, "kg", "kg")).toBe("142.881 kg");
    });
  });

  describe("roundToDisplay", () => {
    it("rounds to 2 decimal places", () => {
      expect(roundToDisplay(142.881596)).toBe(142.88);
      expect(roundToDisplay(220.462262)).toBe(220.46);
    });

    it("leaves a value with <=2 decimals unchanged", () => {
      expect(roundToDisplay(316.25)).toBe(316.25);
      expect(roundToDisplay(100)).toBe(100);
    });
  });
});
