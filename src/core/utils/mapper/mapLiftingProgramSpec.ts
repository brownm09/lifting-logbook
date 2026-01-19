import { LIFTING_PROGRAM_SPEC_HEADER_MAP } from "../../constants/schema";
import { LiftingProgramSpec } from "../../models/LiftingProgramSpec";
/**
 * Converts an array of LiftingProgramSpec objects to a 2D array (for writing to a sheet)
 * @param {LiftingProgramSpec[]} specs
 * @returns {any[][]} 2D array with headers in row 0
 */
export function mapLiftingProgramSpec(specs: LiftingProgramSpec[]): any[][] {
  const headers = Object.keys(LIFTING_PROGRAM_SPEC_HEADER_MAP);
  return [
    headers,
    ...specs.map((spec) =>
      headers.map(
        (header) => spec[LIFTING_PROGRAM_SPEC_HEADER_MAP[header].key],
      ),
    ),
  ];
}
