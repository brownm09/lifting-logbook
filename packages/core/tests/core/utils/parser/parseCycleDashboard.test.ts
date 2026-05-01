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
});
