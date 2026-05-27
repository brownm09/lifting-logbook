import { parseCycleDashboard, Weekday } from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("parseCycleDashboard", () => {
  it("parses dashboard CSV data into a CycleDashboard object", () => {
    const data = loadCsvFixture("dashboard_20260105.csv");
    const result = parseCycleDashboard(data);
    expect(result).toEqual({
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 1,
      cycleDate: new Date("1/5/2026"),
      sheetName: "RPT_Cycle_1_20260105",
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training',
    });
  });

  // Audit (#354): pin current behavior of the missing-key neutral-return branches.
  // parseCycleDashboard silently defaults missing keys to "" / NaN / Invalid Date —
  // unlike sibling parser parseTrainingMaxes, which throws. The inconsistency is
  // tracked in a follow-up issue; this test exists so any future behavior change
  // (e.g., switching to throw-on-missing) is deliberate and visible in the diff.
  it("returns sentinel defaults when required keys are missing", () => {
    const result = parseCycleDashboard([]);
    expect(result.program).toBe("");
    expect(result.cycleUnit).toBe("");
    expect(Number.isNaN(result.cycleNum)).toBe(true);
    expect(result.cycleDate.toString()).toBe("Invalid Date");
    expect(result.sheetName).toBe("");
    expect(result.cycleStartWeekday).toBe("");
    expect(result.currentWeekType).toBe("training");
  });
});
