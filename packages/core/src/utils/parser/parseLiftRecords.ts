import { LIFT_RECORD_HEADER_MAP, LiftRecord, SpreadsheetCell } from "@src/core";
import { tableToObjects } from "./tableToObjects";

/**
 * Converts a 2D array to an array of LiftRecord objects.
 * @param {SpreadsheetCell[][]} data
 * @returns {LiftRecord[]}
 */

export function parseLiftRecords(data: SpreadsheetCell[][]): LiftRecord[] {
  const headerMap = LIFT_RECORD_HEADER_MAP;
  const rawObjects = tableToObjects(data, undefined);
  return rawObjects.map((obj) => {
    const result: Record<string, unknown> = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header]!;
      let value: unknown = obj[header];
      if (type === "number") {
        value = Number(value);
      }
      if (key === "date") {
        value = new Date(String(value ?? ""));
      }
      result[key] = value;
    }
    return result as unknown as LiftRecord;
  });
}
