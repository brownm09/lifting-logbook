import { LIFTING_PROGRAM_SPEC_HEADER_MAP } from "@src/core/constants";
import { LiftingProgramSpec, SpreadsheetCell } from "@src/core/models";
import { tableToObjects } from "./tableToObjects";

/**
 * Converts a 2D array to an array of LiftingProgramSpec objects.
 * @param {SpreadsheetCell[][]} data
 * @returns {LiftingProgramSpec[]}
 */

export function parseLiftingProgramSpec(data: SpreadsheetCell[][]): LiftingProgramSpec[] {
  // Use header map from constants
  const headerMap = LIFTING_PROGRAM_SPEC_HEADER_MAP;
  // Convert using tableToObjects, then cast/convert types
  const rawObjects = tableToObjects(data, undefined);
  const parsed = rawObjects.map((obj) => {
    const result: Record<string, unknown> = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header]!;
      let value: unknown = obj[header];
      if (type === "number") {
        value = Number(value);
      } else if (type === "boolean|string") {
        if (value === "TRUE" || value === true) value = true;
        else if (value === "FALSE" || value === false) value = false;
        // else leave as string
      }
      result[key] = value;
    }
    return result as unknown as LiftingProgramSpec;
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
