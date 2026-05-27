import { WeekType } from "@lifting-logbook/types";
import { CycleDashboard, SpreadsheetCell, Weekday } from "@src/core/models";
import {
  CYCLE_DATE_KEY,
  CYCLE_NUM_KEY,
  CYCLE_START_WEEKDAY_KEY,
  CYCLE_UNIT_KEY,
  PROGRAM_KEY,
  SHEET_NAME_KEY,
} from "@src/core/constants";

/**
 * Parses a 2D array (from CSV or sheet) into a CycleDashboard object.
 * @param {SpreadsheetCell[][]} data - 2D array with headers in column 0 and values in column 1
 * @returns {CycleDashboard}
 */
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseCycleDashboard(data: SpreadsheetCell[][]): CycleDashboard {
  const map: Record<string, SpreadsheetCell | undefined> = {};
  data.forEach(([key, value]) => {
    map[String(key)] = value;
  });

  const program = String(map[PROGRAM_KEY] ?? "");
  const cycleUnit = String(map[CYCLE_UNIT_KEY] ?? "");
  const cycleNum = Number(map[CYCLE_NUM_KEY]);
  const cycleDate = new Date(String(map[CYCLE_DATE_KEY] ?? ""));
  const sheetName = String(map[SHEET_NAME_KEY] ?? "");
  const cycleStartWeekday = toTitleCase(
    String(map[CYCLE_START_WEEKDAY_KEY] ?? ""),
  ) as Weekday;

  if (program.length === 0) {
    throw new Error(`Invalid ${PROGRAM_KEY} value: ${String(map[PROGRAM_KEY])}`);
  }
  if (cycleUnit.length === 0) {
    throw new Error(`Invalid ${CYCLE_UNIT_KEY} value: ${String(map[CYCLE_UNIT_KEY])}`);
  }
  if (isNaN(cycleNum)) {
    throw new Error(`Invalid ${CYCLE_NUM_KEY} value: ${String(map[CYCLE_NUM_KEY])}`);
  }
  if (isNaN(cycleDate.getTime())) {
    throw new Error(`Invalid ${CYCLE_DATE_KEY} value: ${String(map[CYCLE_DATE_KEY])}`);
  }
  if (sheetName.length === 0) {
    throw new Error(`Invalid ${SHEET_NAME_KEY} value: ${String(map[SHEET_NAME_KEY])}`);
  }
  if (cycleStartWeekday.length === 0) {
    throw new Error(
      `Invalid ${CYCLE_START_WEEKDAY_KEY} value: ${String(map[CYCLE_START_WEEKDAY_KEY])}`,
    );
  }

  return {
    program,
    cycleUnit,
    cycleNum,
    cycleDate,
    sheetName,
    cycleStartWeekday,
    // currentWeekType is derived from the program spec at request time, not stored in the dashboard sheet
    currentWeekType: 'training' as WeekType,
  };
}
