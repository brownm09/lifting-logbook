import { LIFTING_PROGRAM_SPEC_HEADER_MAP, LiftingProgramSpec, SpreadsheetCell } from "@src/core";
/**
 * Converts an array of LiftingProgramSpec objects to a 2D array (for writing to a sheet)
 * @param {LiftingProgramSpec[]} specs
 * @returns {SpreadsheetCell[][]} 2D array with headers in row 0
 */
export function mapLiftingProgramSpec(specs: LiftingProgramSpec[]): SpreadsheetCell[][] {
  const headers = Object.keys(LIFTING_PROGRAM_SPEC_HEADER_MAP);
  return [
    headers,
    ...specs.map((spec) =>
      headers.map((header) => {
        const { key, type } = LIFTING_PROGRAM_SPEC_HEADER_MAP[header]!;
        const value = spec[key as keyof LiftingProgramSpec];
        if (type === "boolean|string" && typeof value === "boolean") {
          return value ? "TRUE" : "FALSE";
        }
        return value as SpreadsheetCell;
      }),
    ),
  ];
}
