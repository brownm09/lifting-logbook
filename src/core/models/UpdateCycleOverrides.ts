/**
 * Updates the dashboard cycle: increments cycleNum, updates cycleDate to the next Monday (at least 7 days after previous), and updates sheetLink.
 * @param prevCycle CycleDashboard
 * @param overrides Optional overrides for weekday or start date
 * @returns Updated CycleDashboard
 */

export interface UpdateCycleOverrides {
  targetWeekday?: string;
  today?: Date;
  overrideDate?: Date;
  updateStartWeekday?: boolean;
}
