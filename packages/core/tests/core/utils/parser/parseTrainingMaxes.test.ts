import { parseTrainingMaxes } from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("parseTrainingMaxes", () => {
  it("converts training_maxes.csv to array of objects", () => {
    const data = loadCsvFixture("training_maxes.csv");
    const result = parseTrainingMaxes(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!).toHaveProperty("dateUpdated");
    // Should be a Date object
    expect(result[0]!.dateUpdated).toBeInstanceOf(Date);
    expect(result[0]!).toHaveProperty("lift");
    expect(result[0]!).toHaveProperty("weight");
  });

  it("parses weight as a number", () => {
    const data = [
      ["Date Updated", "Lift", "Weight"],
      ["2024-01-01", "Squat", "200"],
    ];
    const result = parseTrainingMaxes(data);
    expect(typeof result[0]!.weight).toBe("number");
    expect(result[0]!.weight).toBe(200);
  });

  it("parses dateUpdated as a Date object", () => {
    const data = [
      ["Date Updated", "Lift", "Weight"],
      ["2024-01-01", "Bench", "150"],
    ];
    const result = parseTrainingMaxes(data);
    expect(result[0]!.dateUpdated).toBeInstanceOf(Date);
    expect(result[0]!.dateUpdated.toISOString().startsWith("2024-01-01")).toBe(
      true,
    );
  });

  it("handles empty data gracefully", () => {
    const data: any[][] = [];
    const result = parseTrainingMaxes(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("throws error for missing required fields", () => {
    const data = [
      ["Date Updated", "Lift"],
      ["2024-01-01", "Deadlift"],
    ];
    expect(() => parseTrainingMaxes(data)).toThrow();
  });
});
