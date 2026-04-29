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
  return {
    program: String(map[PROGRAM_KEY] ?? ""),
    cycleUnit: String(map[CYCLE_UNIT_KEY] ?? ""),
    cycleNum: Number(map[CYCLE_NUM_KEY]),
    cycleDate: new Date(String(map[CYCLE_DATE_KEY] ?? "")),
    sheetName: String(map[SHEET_NAME_KEY] ?? ""),
    cycleStartWeekday: toTitleCase(String(map[CYCLE_START_WEEKDAY_KEY] ?? "")) as Weekday,
  };
}
