import { CycleDashboard } from "../../../../src/core/models/CycleDashboard";
import { updateCycle } from "../../../../src/core/services/dashboard/updateCycle";

describe("updateCycle", () => {
  it("increments cycleNum, updates cycleDate and sheetName for next Monday", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 1,
      cycleDate: "1/5/2026",
      sheetName: "RPT_Cycle_1_20260105",
    };
    const updated = updateCycle(prev, "Monday", new Date("2026-01-20"));
    expect(updated.cycleNum).toBe(2);
    expect(updated.sheetName).toBe("RPT_Cycle_2_20260119");
    expect(updated.cycleDate).toBe("1/19/2026");
  });

  it("can update to a different weekday if specified", () => {
    const prev: CycleDashboard = {
      program: "RPT",
      cycleUnit: "Week",
      cycleNum: 1,
      cycleDate: "1/5/2026",
      sheetName: "RPT_Cycle_1_20260105",
    };
    // Simulate update to Friday (5)
    const updated = updateCycle(prev, "Friday");
    expect(updated.cycleNum).toBe(2);
    expect(updated.sheetName).toBe("RPT_Cycle_2_20260116");
    expect(updated.cycleDate).toBe("1/16/2026");
    // Should be a Friday
    const date = new Date(updated.cycleDate);
    expect(date.getUTCDay()).toBe(5);
  });
});
