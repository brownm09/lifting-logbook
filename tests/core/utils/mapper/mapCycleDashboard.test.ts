import { CycleDashboard, mapCycleDashboard, Weekday } from "@src/core";

describe("mapCycleDashboard", () => {
  it("should map CycleDashboard object to 2D array with all keys", () => {
    const obj: CycleDashboard = {
      program: "5/3/1",
      cycleUnit: "Week",
      cycleNum: 1,
      cycleDate: new Date("2026-01-01"),
      sheetName: "Week 1",
      cycleStartWeekday: Weekday.Friday,
    };
    const result = mapCycleDashboard(obj);
    expect(result).toEqual([
      ["Key", "Value"],
      ["Program", "5/3/1"],
      ["Cycle Unit", "Week"],
      ["Cycle #", 1],
      ["Cycle Date", new Date("2026-01-01")],
      ["Sheet Name", "Week 1"],
      ["Cycle Start Weekday", Weekday.Friday],
    ]);
  });
});
