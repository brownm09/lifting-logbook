import {
  generateLiftSpec,
  parseLiftingProgramSpec,
  parseTrainingMaxes,
} from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

const trainingMaxesData = loadCsvFixture("training_maxes.csv");
const rptProgramSpecData = loadCsvFixture("rpt_program_spec.csv");
const trainingMaxes = parseTrainingMaxes(trainingMaxesData);
const rptProgramSpec = parseLiftingProgramSpec(rptProgramSpecData);

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
    expect(result[4]).toEqual(new Date("2026-01-01")); // offset 0
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
    expect(result[4]).toEqual(new Date("2026-01-05")); // offset 4
    expect(result[5]).toBe("KB Swing"); // activation
  });
});
