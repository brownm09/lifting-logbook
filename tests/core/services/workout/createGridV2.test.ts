import { createGridV2 } from "../../../../src/core/services/workout/createGridV2";
import { parseRptProgramSpec } from "../../../../src/core/utils/parser/parseRptProgramSpec";
import { parseTrainingMaxes } from "../../../../src/core/utils/parser/parseTrainingMaxes";
import { loadCsvFixture } from "../../../testUtils";

describe("createGridV2", () => {
  const trainingMaxesData = loadCsvFixture("training_maxes.csv");
  const rptProgramSpecData = loadCsvFixture("rpt_program_spec.csv");
  const trainingMaxes = parseTrainingMaxes(trainingMaxesData);
  const rptProgramSpec = parseRptProgramSpec(rptProgramSpecData);

  it("creates a grid with the new training values", () => {
    // console.log('Training Maxes:', trainingMaxesData);
    // console.log('RPT Program Spec:', rptProgramSpecData);
    // Use these fixtures as needed in your test
    const result = createGridV2(
      rptProgramSpec,
      trainingMaxes,
      new Date("2026-01-01"),
    );
    expect(result.length).toBe(77);
    // console.log(result);
    // expect(Array.isArray(trainingMaxesData)).toBe(true);
    // expect(Array.isArray(rptProgramSpecData)).toBe(true);
    // expect(Array.isArray(trainingMaxes)).toBe(true);
    // expect(Array.isArray(rptProgramSpec)).toBe(true);
    // Example usage:
    // expect(createGridV2(rptProgramSpec, trainingMaxes, ...)).toEqual(...);
  });
});
