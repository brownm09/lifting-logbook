import {
  LiftingProgramSpec,
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

  it("test week: final set weight becomes new TM with no increment", () => {
    const tmData = loadCsvFixture("training_maxes.csv");
    const specData = loadCsvFixture("rpt_program_spec_test_week.csv");
    const liftData = loadCsvFixture("lift_records_test_week.csv");
    const expectedData = loadCsvFixture("training_maxes_test_week.csv");
    const trainingMaxes = parseTrainingMaxes(tmData);
    const programSpec = parseLiftingProgramSpec(specData);
    const liftRecords = parseLiftRecords(liftData);
    const expectedMaxes = parseTrainingMaxes(expectedData);

    const updated = updateMaxes(programSpec, trainingMaxes, liftRecords);
    expect(updated).toEqual(expectedMaxes);

    // Specifically verify no increment was applied
    const benchMax = updated.find((m) => m.lift === "Bench P.")!;
    expect(benchMax.weight).toBe(185); // final set weight, not 185 + 2.5 increment
  });

  it("test week: skips update when final set notes flag abnormal condition", () => {
    const tmData = loadCsvFixture("training_maxes.csv");
    const specData = loadCsvFixture("rpt_program_spec_test_week.csv");
    const trainingMaxes = parseTrainingMaxes(tmData);
    const programSpec = parseLiftingProgramSpec(specData);

    // All 5 sets flagged as injury
    const liftRecords = [1, 2, 3, 4, 5].map((setNum) => ({
      program: "RPT",
      cycleNum: 1,
      workoutNum: 1,
      date: new Date("2026-01-05"),
      lift: "Bench P." as const,
      setNum,
      weight: 100 + setNum * 20,
      reps: setNum === 5 ? 1 : 3,
      notes: "injury",
    }));

    const updated = updateMaxes(programSpec, trainingMaxes, liftRecords);
    const benchMax = updated.find((m) => m.lift === "Bench P.")!;
    const originalBenchMax = trainingMaxes.find((m) => m.lift === "Bench P.")!;
    expect(benchMax.weight).toBe(originalBenchMax.weight); // unchanged
  });

  it("deload week: returns maxes unchanged", () => {
    const tmData = loadCsvFixture("training_maxes.csv");
    const specData = loadCsvFixture("rpt_program_spec_deload_week.csv");
    const trainingMaxes = parseTrainingMaxes(tmData);
    const programSpec = parseLiftingProgramSpec(specData);

    // A completed deload set — should never update the max
    const liftRecords = [1, 2, 3].map((setNum) => ({
      program: "RPT",
      cycleNum: 1,
      workoutNum: 1,
      date: new Date("2026-01-05"),
      lift: "Bench P." as const,
      setNum,
      weight: 100,
      reps: 5,
      notes: "",
    }));

    const updated = updateMaxes(programSpec, trainingMaxes, liftRecords);
    const benchMax = updated.find((m) => m.lift === "Bench P.")!;
    const originalBenchMax = trainingMaxes.find((m) => m.lift === "Bench P.")!;
    expect(benchMax.weight).toBe(originalBenchMax.weight);
    expect(benchMax.dateUpdated).toEqual(originalBenchMax.dateUpdated);
  });
});
