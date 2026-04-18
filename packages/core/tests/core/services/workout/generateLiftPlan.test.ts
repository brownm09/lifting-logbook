import {
  generateLiftPlan,
  parseLiftingProgramSpec,
  parseTrainingMaxes,
} from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

const trainingMaxesData = loadCsvFixture("training_maxes.csv");
const rptProgramSpecData = loadCsvFixture("rpt_program_spec.csv");
const trainingMaxes = parseTrainingMaxes(trainingMaxesData);
const rptProgramSpec = parseLiftingProgramSpec(rptProgramSpecData);

describe("generateLiftPlan", () => {
  it("generates correct lift plan for Bench P.", () => {
    const tm = trainingMaxes.find((t) => t.lift === "Bench P.")!;
    const ps = rptProgramSpec.find((p) => p.lift === "Bench P.")!;
    const startDate = new Date("2026-01-01");
    const plan = generateLiftPlan(tm, ps, startDate);
    expect(Array.isArray(plan)).toBe(true);
    expect(plan.length).toBe(6); // 3 warm-up + 3 work sets
    // Check first warm-up set
    const warmup = plan.find((row) => row[2] && row[2].startsWith("Warm-up"));
    expect(warmup).toBeDefined();
    expect(warmup![1]).toBe("Bench P.");
    expect(warmup![2]).toMatch(/Warm-up \d+/);
    expect(warmup![4]).toBe(5);
    // Check first work set
    const workset = plan.find((row) => row[2] && row[2].startsWith("Set"));
    expect(workset).toBeDefined();
    expect(workset![1]).toBe("Bench P.");
    expect(workset![2]).toMatch(/Set \d+/);
  });
});
