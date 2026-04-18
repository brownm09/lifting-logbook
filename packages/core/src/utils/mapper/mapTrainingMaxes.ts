import { TRAINING_MAX_HEADER_MAP, TrainingMax } from "@src/core";
/**
 * Converts an array of TrainingMax objects to a 2D array (for writing to a sheet)
 * @param {TrainingMax[]} maxes
 * @returns {any[][]} 2D array with headers in row 0
 */
export function mapTrainingMaxes(maxes: TrainingMax[]): any[][] {
  const headers = Object.keys(TRAINING_MAX_HEADER_MAP);
  return [
    headers,
    ...maxes.map((max) =>
      headers.map((header) => max[TRAINING_MAX_HEADER_MAP[header]!.key as keyof TrainingMax]),
    ),
  ];
}
