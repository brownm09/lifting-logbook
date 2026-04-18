import {
  parseLiftingProgramSpec,
  parseLiftRecords,
  parseTrainingMaxes,
  TrainingMax,
  updateMaxes,
} from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("updateMaxes", () => {
  it("updates only the correct training maxes and leaves others unchanged", () => {
    const tmData = loadCsvFixture("training_maxes.csv");
    const specData = loadCsvFixture("rpt_program_spec.csv");
    const liftData = loadCsvFixture("lift_records_week_1_20260105.csv");
    const newTmData = loadCsvFixture("training_maxes_20260105.csv");
    const trainingMaxes = parseTrainingMaxes(tmData);
    const expectedMaxes = parseTrainingMaxes(newTmData);
    const programSpec = parseLiftingProgramSpec(specData);
    const liftRecords = parseLiftRecords(liftData);
    const updatedMaxes = updateMaxes(programSpec, trainingMaxes, liftRecords);
    expect(Array.isArray(updatedMaxes)).toBe(true);
    expect(updatedMaxes.length).toBe(trainingMaxes.length);

    expect(Array.isArray(updatedMaxes)).toBe(true);
    expect(updatedMaxes.length).toBe(trainingMaxes.length);
    // Check that at least one max was updated (date or weight changed)
    const changed = updatedMaxes.some(
      (um, i) =>
        um.weight !== trainingMaxes[i]!.weight ||
        um.dateUpdated.getTime() !== trainingMaxes[i]!.dateUpdated.getTime(),
    );
    expect(changed).toBe(true);

    // Lifts expected to be updated, with their new values
    const expectedUpdates: TrainingMax[] = [
      { lift: "BB Row", dateUpdated: new Date("2026-01-05"), weight: 180 },
      { lift: "Calf Raise", dateUpdated: new Date("2026-01-05"), weight: 220 },
      {
        lift: "C. Lat Raise",
        dateUpdated: new Date("2026-01-05"),
        weight: 13.75,
      },
      { lift: "Chin-up", dateUpdated: new Date("2026-01-07"), weight: 227.5 },
      { lift: "Dip", dateUpdated: new Date("2026-01-07"), weight: 227.5 },
      { lift: "Deadlift", dateUpdated: new Date("2026-01-13"), weight: 267.5 },
    ];

    // Check each lift
    trainingMaxes.forEach((orig, i) => {
      const updated = updatedMaxes[i]!;
      const lift = orig.lift;
      const updatedLiftIdx = expectedUpdates.findIndex(
        (eu) => eu.lift === lift,
      );
      if (updatedLiftIdx !== -1) {
        // Compare only the date part in UTC to avoid timezone issues
        expect(updated.dateUpdated.toISOString().slice(0, 10)).toBe(
          expectedUpdates[updatedLiftIdx]!.dateUpdated
            .toISOString()
            .slice(0, 10),
        );
        expect(updated.weight).toBe(expectedUpdates[updatedLiftIdx]!.weight);
      } else {
        // Should remain unchanged
        expect(updated.dateUpdated).toEqual(orig.dateUpdated);
        expect(updated.weight).toBe(orig.weight);
      }
    });
    expect(updatedMaxes).toEqual(expectedMaxes);
    // Test for idempotency by re-running with updated maxes
    expect(updateMaxes(programSpec, updatedMaxes, liftRecords)).toEqual(
      expectedMaxes,
    );
  });
});
