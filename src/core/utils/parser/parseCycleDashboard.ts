import { CycleDashboard } from "../../models/CycleDashboard";

/**
 * Parses a 2D array (from CSV or sheet) into a CycleDashboard object.
 * @param {any[][]} data - 2D array with headers in column 0 and values in column 1
 * @returns {CycleDashboard}
 */
export function parseCycleDashboard(data: any[][]): CycleDashboard {
  const map: Record<string, string> = {};
  data.forEach(([key, value]) => {
    map[key] = value;
  });
  return {
    program: map["Program"],
    cycleUnit: map["Cycle Unit"],
    cycleNum: Number(map["Cycle #"]),
    cycleDate: new Date(map["Cycle Date"]),
    sheetName: map["Sheet Name"],
  };
}
