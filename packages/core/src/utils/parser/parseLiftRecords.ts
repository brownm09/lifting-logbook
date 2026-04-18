import { LIFT_RECORD_HEADER_MAP, LiftRecord } from "@src/core";
import { tableToObjects } from "./tableToObjects";

/**
 * Converts a 2D array to an array of LiftRecord objects.
 * @param {any[][]} data
 * @returns {LiftRecord[]}
 */

export function parseLiftRecords(data: any[][]): LiftRecord[] {
  const headerMap = LIFT_RECORD_HEADER_MAP;
  const rawObjects = tableToObjects(data, undefined);
  return rawObjects.map((obj) => {
    const result: any = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header]!;
      let value = obj[header];
      if (type === "number") {
        value = Number(value);
      }
      if (key === "date") {
        value = new Date(value);
      }
      result[key] = value;
    }
    return result as LiftRecord;
  });
}
