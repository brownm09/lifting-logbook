import {
  LIFT_DATE_HEADER,
  parseLiftingProgramSpec,
  updateLiftDates,
} from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("updateLiftDates", () => {
  const workoutData = loadCsvFixture("rpt_week_1_20260105.csv");
  const rptProgramSpecData = loadCsvFixture("rpt_program_spec.csv");
  const rptProgramSpec = parseLiftingProgramSpec(rptProgramSpecData);
  const liftDateRow = workoutData.find((row) => row.includes(LIFT_DATE_HEADER));
  if (!liftDateRow) {
    throw new Error(`Header row with "${LIFT_DATE_HEADER}" not found.`);
  }
  const liftDateIdx = liftDateRow.indexOf(LIFT_DATE_HEADER);
  const editedRowIdx = 10; // Row index of the edited lift date
  const newLiftDate = new Date("2026-01-15");

  it("modifies all lift dates of core lifts with matching offset", () => {
    workoutData[editedRowIdx - 1][liftDateIdx] = newLiftDate;
    const result = updateLiftDates(
      workoutData,
      rptProgramSpec,
      editedRowIdx - 1,
    );
    expect(result.length).toBe(77);
    expect(Array.isArray(result)).toBe(true);
    [7, 8, 9, 10].forEach((rowIdx) => {
      expect(result[rowIdx][liftDateIdx]).toEqual(newLiftDate);
    });
  });
});
