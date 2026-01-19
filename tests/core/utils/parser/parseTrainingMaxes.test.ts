import { parseTrainingMaxes } from "../../../../src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("parseTrainingMaxes", () => {
  it("converts training_maxes.csv to array of objects", () => {
    const data = loadCsvFixture("training_maxes.csv");
    const result = parseTrainingMaxes(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("dateUpdated");
    // Should be normalized to YYYY-MM-DD
    expect(result[0].dateUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result[0]).toHaveProperty("lift");
    expect(result[0]).toHaveProperty("weight");
  });
});
