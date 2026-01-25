import { parseLiftRecords } from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("parseLiftRecords", () => {
  it("parses lift records from fixture data", () => {
    const data = loadCsvFixture("lift_records.csv");
    const records = parseLiftRecords(data);
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toHaveProperty("program");
    expect(records[0]).toHaveProperty("cycleNum");
    expect(records[0]).toHaveProperty("workoutNum");
    expect(records[0]).toHaveProperty("setNum");
  });
});
