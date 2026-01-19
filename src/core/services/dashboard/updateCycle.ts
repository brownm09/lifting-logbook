import { CycleDashboard } from "../../models/CycleDashboard";
import { getNextDate } from "../../utils/jsUtil";

/**
 * Updates the dashboard cycle: increments cycleNum, updates cycleDate to the next Monday (at least 7 days after previous), and updates sheetLink.
 * @param prevCycle CycleDashboard
 * @param targetWeekday Optional override for current date (for testing)
 * @returns Updated CycleDashboard
 */
export function updateCycle(
  prevCycle: CycleDashboard,
  targetWeekday?: string,
  today?: Date,
): CycleDashboard {
  const prevNum = prevCycle.cycleNum;
  const prevDate = new Date(prevCycle.cycleDate);
  const now = today ? new Date(today) : new Date();

  // Map weekday string to number
  const weekdayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  // Determine target weekday: if not specified, use previous cycle's weekday
  let targetWeekdayNum: number = prevDate.getUTCDay();
  if (targetWeekday) {
    targetWeekdayNum = weekdayMap[targetWeekday.toLowerCase()];
  }
  // If today matches the target weekday and is at least 7 days after prevDate, use today
  // let cycleDate: Date;
  const cycleDate = getNextDate(prevDate, targetWeekdayNum, today);
  // Format date as M/D/YYYY
  const formattedDate = `${cycleDate.getUTCMonth() + 1}/${cycleDate.getUTCDate()}/${cycleDate.getUTCFullYear()}`;
  // Update sheet link
  const newSheetName = `${prevCycle.program}_Cycle_${prevNum + 1}_${cycleDate.getUTCFullYear()}${String(cycleDate.getUTCMonth() + 1).padStart(2, "0")}${String(cycleDate.getUTCDate()).padStart(2, "0")}`;
  return {
    ...prevCycle,
    cycleNum: prevNum + 1,
    cycleDate: formattedDate,
    sheetName: newSheetName,
  };
}
