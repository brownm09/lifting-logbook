import { LIFTING_PROGRAM_SPEC_HEADER_MAP, LiftingProgramSpec } from "@src/core";
import { tableToObjects } from "./tableToObjects";

/**
 * Converts a 2D array to an array of LiftingProgramSpec objects.
 * @param {any[][]} data
 * @returns {LiftingProgramSpec[]}
 */

export function parseLiftingProgramSpec(data: any[][]): LiftingProgramSpec[] {
  // Use header map from constants
  const headerMap = LIFTING_PROGRAM_SPEC_HEADER_MAP;
  // Convert using tableToObjects, then cast/convert types
  const rawObjects = tableToObjects(data, undefined);
  const parsed = rawObjects.map((obj) => {
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
    return result as LiftingProgramSpec;
  });

  // Sort by offset, then order
  parsed.sort((a, b) => {
    if (a.offset !== b.offset) {
      return a.offset - b.offset;
    }
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return parsed;
}
