import { RPT_PROGRAM_SPEC_HEADER_MAP } from "../../constants/schema";
import { RptProgramSpec } from "../../models/RptProgramSpec";
import { tableToObjects } from "./tableToObjects";

/**
 * Converts a 2D array to an array of RptProgramSpec objects.
 * @param {any[][]} data
 * @returns {RptProgramSpec[]}
 */

export function parseRptProgramSpec(data: any[][]): RptProgramSpec[] {
  // Use header map from constants
  const headerMap = RPT_PROGRAM_SPEC_HEADER_MAP;
  // Convert using tableToObjects, then cast/convert types
  const rawObjects = tableToObjects(data, undefined);
  return rawObjects.map((obj) => {
    const result: any = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header];
      let value = obj[header];
      if (type === "number") {
        value = Number(value);
      } else if (type === "boolean|string") {
        if (value === "TRUE" || value === true) value = true;
        else if (value === "FALSE" || value === false) value = false;
        // else leave as string
      }
      result[key] = value;
    }
    return result as RptProgramSpec;
  });
}
