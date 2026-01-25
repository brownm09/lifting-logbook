import { parseLiftingProgramSpec } from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("parseLiftingProgramSpec", () => {
  it("parses rpt_program_spec.csv to array of LiftingProgramSpec objects", () => {
    const data = loadCsvFixture("rpt_program_spec.csv");
    const result = parseLiftingProgramSpec(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("offset");
    expect(result[0]).toHaveProperty("lift");
    expect(result[0]).toHaveProperty("increment");
    expect(result[0]).toHaveProperty("order");
    expect(result[0]).toHaveProperty("sets");
    expect(result[0]).toHaveProperty("reps");
    expect(result[0]).toHaveProperty("amrap");
    expect(result[0]).toHaveProperty("warmUpPct");
    expect(result[0]).toHaveProperty("wtDecrementPct");
    expect(result[0]).toHaveProperty("activation");
  });
});
