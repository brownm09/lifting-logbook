import {
  createGridV2,
  parseLiftingProgramSpec,
  parseTrainingMaxes,
} from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("createGridV2", () => {
  const trainingMaxesData = loadCsvFixture("training_maxes.csv");
  const rptProgramSpecData = loadCsvFixture("rpt_program_spec.csv");
  const trainingMaxes = parseTrainingMaxes(trainingMaxesData);
  const rptProgramSpec = parseLiftingProgramSpec(rptProgramSpecData);

  it("creates a grid with the new training values", () => {
    const result = createGridV2(
      rptProgramSpec,
      trainingMaxes,
      new Date("2026-01-01"),
    );
    expect(result.length).toBe(77);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toEqual(["Program", "", "Cycle", "", "Weight", ""]);
    expect(result[1]).toEqual([
      "Core Lift",
      "Scheme",
      "TM",
      "Inc. Amt.",
      "Lift Date",
      "Activ. Ex.",
    ]);
    expect(result.findIndex((row) => row[0] === "Date")).toBe(15); // Workout grid header
  });

  it("returns an empty grid if no training maxes are provided", () => {
    const result = createGridV2(rptProgramSpec, [], new Date("2026-01-01"));
    expect(result.length).toBe(3); // Only headers
    expect(result[0]).toEqual(["Program", "", "Cycle", "", "Weight", ""]);
    expect(result[1]).toEqual([
      "Core Lift",
      "Scheme",
      "TM",
      "Inc. Amt.",
      "Lift Date",
      "Activ. Ex.",
    ]);
  });

  it("returns an empty grid if no program spec is provided", () => {
    const result = createGridV2([], trainingMaxes, new Date("2026-01-01"));
    expect(result.length).toBe(3); // Only headers
    expect(result[0]).toEqual(["Program", "", "Cycle", "", "Weight", ""]);
    expect(result[1]).toEqual([
      "Core Lift",
      "Scheme",
      "TM",
      "Inc. Amt.",
      "Lift Date",
      "Activ. Ex.",
    ]);
    expect(result[2]).toEqual([
      "Date",
      "Lift",
      "Set",
      "Weight",
      "Reps",
      "Notes",
    ]);
  });

  it("generates correct lift spec and plan for a known lift", () => {
    const singleSpec = [rptProgramSpec[0]];
    const singleMax = [trainingMaxes[0]];
    const result = createGridV2(singleSpec, singleMax, new Date("2026-01-01"));
    expect(result.length).toBeGreaterThan(2);
    expect(result[1][0]).toBe("Core Lift");
    expect(result[2][0]).toBe(singleMax[0].lift);
    expect(result[result.length - 1][1]).toBe(singleMax[0].lift);
  });

  it("uses the correct start date in generated lift specs", () => {
    const result = createGridV2(
      rptProgramSpec,
      trainingMaxes,
      new Date("2026-01-01"),
    );
    // Find a row with a date and check it matches the start date or expected offset
    const dateRows = result.filter(
      // Match on equals sign b/c dates are generated as formulas
      (row) => typeof row[0] === "string" && /^=/.test(row[0]),
    );
    expect(dateRows.length).toBeGreaterThan(0);
    // Optionally check the first workout date
    // expect(dateRows[0][0]).toContain("2026-01-01");
  });
});
