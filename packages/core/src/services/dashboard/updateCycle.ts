import { WEEKDAY_MAP } from "@src/core/constants";
import { CycleDashboard, Weekday } from "@src/core/models";
import { formatDateYYYYMMDD, getNextDate } from "@src/core/utils/jsUtil";
import { UpdateCycleOverrides } from "../../models/UpdateCycleOverrides";

export function updateCycle(
  prevCycle: CycleDashboard,
  overrides: UpdateCycleOverrides = {},
): CycleDashboard {
  const prevNum = prevCycle.cycleNum;
  const prevDate = new Date(prevCycle.cycleDate);
  const { targetWeekday, today, overrideDate } = overrides;
  let targetWeekdayNum = 0;
  if (!overrideDate) {
    targetWeekdayNum = prevDate.getUTCDay();

    // Determine target weekday: if not specified, use previous cycle's weekday
    if (targetWeekday) {
      targetWeekdayNum = WEEKDAY_MAP[targetWeekday.toLowerCase()]!;
      console.log(
        `Target weekday overridden to ${targetWeekday} (${targetWeekdayNum}).`,
      );
    } else {
      targetWeekdayNum = WEEKDAY_MAP[prevCycle.cycleStartWeekday.toLowerCase()]!;
      console.log(
        `Target weekday set to previous cycle's weekday: ${prevCycle.cycleStartWeekday} (${targetWeekdayNum}).`,
      );
    }
  }
  // If today matches the target weekday and is at least 7 days after prevDate, use today
  // let cycleDate: Date;
  const cycleDate =
    overrideDate ?? getNextDate(prevDate, targetWeekdayNum, today);
  // Update sheet link
  const newSheetName = `${prevCycle.program}_Cycle_${prevNum + 1}_${formatDateYYYYMMDD(cycleDate)}`;
  return {
    ...prevCycle,
    cycleNum: prevNum + 1,
    cycleDate: cycleDate,
    sheetName: newSheetName,
    cycleStartWeekday: overrides.updateStartWeekday
      ? (Object.keys(WEEKDAY_MAP).find(
          (key) => WEEKDAY_MAP[key] === cycleDate.getUTCDay(),
        ) as Weekday)
      : prevCycle.cycleStartWeekday,
  };
}
