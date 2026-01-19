import {
  parseLiftRecords,
  parseRptProgramSpec,
  parseTrainingMaxes,
} from "../../../../src/core";
import { updateMaxes } from "../../../../src/core/services/maxes/updateMaxes";
import { loadCsvFixture } from "../../../testUtils";

describe("updateMaxes", () => {
  it("updates only the correct training maxes and leaves others unchanged", () => {
    const tmData = loadCsvFixture("training_maxes.csv");
    const specData = loadCsvFixture("rpt_program_spec.csv");
    const liftData = loadCsvFixture("lift_records_week_1_20260105.csv");
    const trainingMaxes = parseTrainingMaxes(tmData);
    const programSpec = parseRptProgramSpec(specData);
    const liftRecords = parseLiftRecords(liftData);
    const updatedMaxes = updateMaxes(trainingMaxes, liftRecords, programSpec);
    expect(Array.isArray(updatedMaxes)).toBe(true);
    expect(updatedMaxes.length).toBe(trainingMaxes.length);

    expect(Array.isArray(updatedMaxes)).toBe(true);
    expect(updatedMaxes.length).toBe(trainingMaxes.length);
    // Check that at least one max was updated (date or weight changed)
    const changed = updatedMaxes.some(
      (um, i) =>
        um.weight !== trainingMaxes[i].weight ||
        um.date !== trainingMaxes[i].date,
    );
    expect(changed).toBe(true);

    // Lifts expected to be updated, with their new values
    const expectedUpdates = {
      "BB Row": { dateUpdated: "2026-01-05", weight: 180 },
      "Calf Raise": { dateUpdated: "2026-01-05", weight: 220 },
      "C. Lat Raise": { dateUpdated: "2026-01-05", weight: 13.75 },
      "Chin-up": { dateUpdated: "2026-01-07", weight: 227.5 },
      Dip: { dateUpdated: "2026-01-07", weight: 227.5 },
      Deadlift: { dateUpdated: "2026-01-13", weight: 267.5 },
    };

    // Check each lift
    trainingMaxes.forEach((orig, i) => {
      const updated = updatedMaxes[i];
      const lift = orig.lift;
      if (expectedUpdates[lift]) {
        expect(updated.dateUpdated).toBe(expectedUpdates[lift].dateUpdated);
        expect(updated.weight).toBeCloseTo(expectedUpdates[lift].weight);
      } else {
        // Should remain unchanged
        expect(updated.dateUpdated).toBe(orig.dateUpdated);
        expect(updated.weight).toBe(orig.weight);
      }
    });
  });
});
