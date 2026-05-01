import { CycleDashboard, updateCycle, Weekday } from "@src/core";

describe("updateCycle", () => {
  it("increments cycleNum, updates cycleDate and sheetName for next Monday", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 1,
      cycleDate: new Date(2026, 0, 5, 0, 0, 0, 0),
      sheetName: "RPT_Cycle_1_20260105",
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training',
    };
    const overrides = {
      targetWeekday: "Monday" as Weekday,
      today: new Date(2026, 0, 20, 0, 0, 0, 0),
    };
    const updated = updateCycle(prev, overrides);
    expect(updated.cycleNum).toBe(2);
    expect(updated.sheetName).toBe("RPT_Cycle_2_20260119");
    expect(updated.cycleDate).toEqual(new Date(2026, 0, 19, 0, 0, 0, 0));
  });

  it("can update to a different weekday if specified", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 1,
      cycleDate: new Date(2026, 0, 5, 0, 0, 0, 0),
      sheetName: "RPT_Cycle_1_20260105",
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training',
    };
    const overrides = {
      targetWeekday: "Friday" as Weekday,
      today: new Date(2026, 0, 16, 0, 0, 0, 0),
    };
    const updated = updateCycle(prev, overrides);
    expect(updated.cycleNum).toBe(2);
    expect(updated.sheetName).toBe("RPT_Cycle_2_20260116");
    expect(updated.cycleDate).toEqual(new Date(2026, 0, 16, 0, 0, 0, 0));
    // Should be a Friday
    const date = new Date(updated.cycleDate);
    expect(date.getUTCDay()).toBe(5);
  });

  it("defaults to previous cycle's weekday if targetWeekday is not specified", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 2,
      cycleDate: new Date(2026, 0, 12, 0, 0, 0, 0), // Monday
      sheetName: "RPT_Cycle_2_20260112",
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training',
    };
    const overrides = {
      today: new Date(2026, 0, 19, 0, 0, 0, 0),
    };
    const updated = updateCycle(prev, overrides);
    expect(updated.cycleNum).toBe(3);
    expect(updated.sheetName).toBe("RPT_Cycle_3_20260119");
    expect(updated.cycleDate).toEqual(new Date(2026, 0, 19, 0, 0, 0, 0));
    expect(new Date(updated.cycleDate).getUTCDay()).toBe(1); // Monday
  });

  it("handles case-insensitive weekday names", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 3,
      cycleDate: new Date(2026, 0, 19, 0, 0, 0, 0), // Monday
      sheetName: "RPT_Cycle_3_20260119",
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training',
    };
    const overrides = {
      targetWeekday: "friday" as Weekday,
      today: new Date(2026, 0, 23, 0, 0, 0, 0),
    };
    const updated = updateCycle(prev, overrides);
    expect(updated.cycleNum).toBe(4);
    expect(updated.sheetName).toBe("RPT_Cycle_4_20260130");
    expect(updated.cycleDate).toEqual(new Date(2026, 0, 30, 0, 0, 0, 0));
    expect(new Date(updated.cycleDate).getUTCDay()).toBe(5); // Friday
  });

  it("returns correct cycleDate even if today is before the next cycle", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 4,
      cycleDate: new Date(2026, 0, 23, 0, 0, 0, 0), // Friday
      sheetName: "RPT_Cycle_4_20260123",
      cycleStartWeekday: Weekday.Friday,
      currentWeekType: 'training',
    };
    // Today is before the next Friday
    const overrides = {
      targetWeekday: "Friday" as Weekday,
      today: new Date(2026, 0, 24, 0, 0, 0, 0),
    };
    const updated = updateCycle(prev, overrides);
    expect(updated.cycleNum).toBe(5);
    expect(updated.sheetName).toBe("RPT_Cycle_5_20260130");
    expect(updated.cycleDate).toEqual(new Date(2026, 0, 30, 0, 0, 0, 0));
    expect(new Date(updated.cycleDate).getUTCDay()).toBe(5); // Friday
  });

  it("works with Sunday as the target weekday", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 5,
      cycleDate: new Date(2026, 0, 25, 0, 0, 0, 0), // Sunday
      sheetName: "RPT_Cycle_5_20260125",
      cycleStartWeekday: Weekday.Sunday,
      currentWeekType: 'training',
    };
    const overrides = {
      targetWeekday: "Sunday" as Weekday,
      today: new Date(2026, 1, 1, 0, 0, 0, 0),
    };
    const updated = updateCycle(prev, overrides);
    expect(updated.cycleNum).toBe(6);
    expect(updated.sheetName).toBe("RPT_Cycle_6_20260201");
    expect(updated.cycleDate).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
    expect(new Date(updated.cycleDate).getUTCDay()).toBe(0); // Sunday
  });
});
