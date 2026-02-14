import {
  calculateLiftWeights,
  LIFT_DATE_HEADER,
  parseLiftingProgramSpec,
} from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("calculateLiftWeights", () => {
  const workoutData = loadCsvFixture("rpt_week_1_20260105.csv");
  const rptProgramSpecData = loadCsvFixture("rpt_program_spec.csv");
  const rptProgramSpec = parseLiftingProgramSpec(rptProgramSpecData);

  const metaHeaderRowIdx = workoutData.findIndex((row) =>
    row.includes(LIFT_DATE_HEADER),
  );
  const entryHeaderRowIdx = workoutData.findIndex((row) =>
    row.includes("Notes"),
  );
  const liftTmIdx = workoutData[metaHeaderRowIdx].indexOf("Weight");
  const entryWeightIdx = workoutData[entryHeaderRowIdx].indexOf("Weight");
  const liftSpecRowIdx = workoutData.findIndex(
    (row) => row.includes("Squat") && row.includes("KB Swing"),
  );
  const liftSpecColIdx = workoutData[liftSpecRowIdx].indexOf("Weight");

  it("throws an error if edited column is not the Weight column", () => {
    workoutData[liftSpecRowIdx][liftTmIdx] = 105; // Set a known TM value for testing
    expect(() =>
      calculateLiftWeights(
        workoutData,
        rptProgramSpec,
        liftSpecRowIdx,
        liftSpecColIdx + 1,
      ),
    ).toThrow();
  });

  it("throws an error if edited row is not the Weight row", () => {
    workoutData[liftSpecRowIdx][liftTmIdx] = 105; // Set a known TM value for testing
    expect(() =>
      calculateLiftWeights(workoutData, rptProgramSpec, -1, liftSpecColIdx),
    ).toThrow();
  });

  it("modifies all lift weights of core lift with matching offset", () => {
    workoutData[liftSpecRowIdx][liftTmIdx] = 105; // Set a known TM value for testing
    const result = calculateLiftWeights(
      workoutData,
      rptProgramSpec,
      liftSpecRowIdx,
      liftSpecColIdx,
    );
    const expectedWeights = [42.5, 62.5, 85, 105, 95, 85];
    const actualWeights = Array.from(
      { length: 6 },
      (_, i) => result[41 + i][entryWeightIdx],
    );
    expect(result.length).toBe(77);
    expect(Array.isArray(result)).toBe(true);
    expect(actualWeights).toEqual(expectedWeights);
  });
});
