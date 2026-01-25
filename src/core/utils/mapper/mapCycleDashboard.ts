import { CycleDashboard } from "@src/core";
/**
 * Converts a CycleDashboard object to a 2D array (for writing to a sheet)
 * @param {CycleDashboard} obj
 * @returns {any[][]} 2D array with [key, value] pairs
 */
export function mapCycleDashboard(obj: CycleDashboard): any[][] {
  return [
    ["Key", "Value"],
    ["Program", obj.program],
    ["Cycle Unit", obj.cycleUnit],
    ["Cycle #", obj.cycleNum],
    ["Cycle Date", obj.cycleDate],
    ["Sheet Name", obj.sheetName],
  ];
}
