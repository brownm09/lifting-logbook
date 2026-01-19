import {
  createGridV2,
  extractLiftRecords,
  generateLiftPlan,
  generateLiftSpec,
} from "../src/core/services/workout";
import {
  parseRptProgramSpec,
  parseTrainingMaxes,
} from "../src/core/utils/dataParser";
import { loadCsvFixture } from "./testUtils";

describe("workout", () => {
  const trainingMaxesData = loadCsvFixture("training_maxes.csv");
  const rptProgramSpecData = loadCsvFixture("rpt_program_spec.csv");
  const trainingMaxes = parseTrainingMaxes(trainingMaxesData);
  const rptProgramSpec = parseRptProgramSpec(rptProgramSpecData);

  describe("createGridV2", () => {
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

  describe("generateLiftSpec", () => {
    it("generates correct lift spec for Bench P.", () => {
      const tm = trainingMaxes.find((t) => t.lift === "Bench P.");
      const ps = rptProgramSpec.find((p) => p.lift === "Bench P.");
      const startDate = new Date("2026-01-01");
      const result = generateLiftSpec(tm, ps, startDate);
      expect(result[0]).toBe("Bench P."); // lift
      expect(result[1]).toBe("3 × 8"); // sets × reps
      expect(result[2]).toBe(182.5); // weight
      expect(result[3]).toBe(2.5); // increment
      expect(result[4]).toBe("2026-01-01"); // offset 0
      expect(result[5]).toBe("Band Flye"); // activation
    });
    it("generates correct lift spec for Deadlift", () => {
      const tm = trainingMaxes.find((t) => t.lift === "Deadlift");
      const ps = rptProgramSpec.find((p) => p.lift === "Deadlift");
      const startDate = new Date("2026-01-01");
      const result = generateLiftSpec(tm, ps, startDate);
      expect(result[0]).toBe("Deadlift"); // lift
      expect(result[1]).toBe("2 × 6"); // sets × reps
      expect(result[2]).toBe(275); // weight
      expect(result[3]).toBe(2.5); // increment
      expect(result[4]).toBe("2026-01-05"); // offset 4
      expect(result[5]).toBe("KB Swing"); // activation
    });
  });

  describe("generateLiftPlan", () => {
    it("generates correct lift plan for Bench P.", () => {
      const tm = trainingMaxes.find((t) => t.lift === "Bench P.");
      const ps = rptProgramSpec.find((p) => p.lift === "Bench P.");
      const startDate = new Date("2026-01-01");
      const plan = generateLiftPlan(tm, ps, startDate);
      expect(Array.isArray(plan)).toBe(true);
      expect(plan.length).toBe(6); // 3 warm-up + 3 work sets
      // Check first warm-up set
      const warmup = plan.find((row) => row[2] && row[2].startsWith("Warm-up"));
      expect(warmup).toBeDefined();
      expect(warmup[1]).toBe("Bench P.");
      expect(warmup[2]).toMatch(/Warm-up \d+/);
      expect(warmup[4]).toBe(5);
      // Check first work set
      const workset = plan.find((row) => row[2] && row[2].startsWith("Set"));
      expect(workset).toBeDefined();
      expect(workset[1]).toBe("Bench P.");
      expect(workset[2]).toMatch(/Set \d+/);
    });
  });

  describe("extractLiftRecords", () => {
    it("throws an error when program or cycle number is missing", () => {
      const data = loadCsvFixture("rpt_week_1_20260105_err.csv");
      expect(() => extractLiftRecords(data)).toThrow(
        "Missing required program or cycle number in lift records data.",
      );
    });
    it("extracts valid lift records from a 2D grid, skipping incomplete rows", () => {
      const data = loadCsvFixture("rpt_week_1_20260105.csv");
      const records = extractLiftRecords(data);
      // Should only include rows with all required fields (Date, Lift, Set, Weight, Reps)
      expect(Array.isArray(records)).toBe(true);
      // Should have the expected number of work sets (excluding warm-ups and incomplete rows)
      expect(records.length).toBe(22);
      // Check a few known records
      expect(records).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            program: "RPT",
            cycleNum: 1,
            workoutNum: 1,
            date: "1/5/2026",
            lift: "Bench P.",
            setNum: 1,
            weight: 72.5,
            reps: 5,
          }),
        ]),
      );
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            program: "RPT",
            cycleNum: 1,
            workoutNum: 1,
            date: "1/5/2026",
            lift: "Bench P.",
            setNum: 1,
            weight: 182.5,
            reps: 6,
            notes: "Might consider a different activation exercise.",
          }),
          expect.objectContaining({
            program: "RPT",
            cycleNum: 1,
            workoutNum: 3,
            date: "1/13/2026",
            lift: "Deadlift",
            setNum: 2,
            weight: 237.5,
            reps: 9,
          }),
        ]),
      );
      // Should skip rows missing required fields (e.g., OH Press-HV Set 1)
      expect(
        records.find((r) => r.lift === "OH Press-HV" && r.setNum === 1),
      ).toBeUndefined();
    });
  });
});
