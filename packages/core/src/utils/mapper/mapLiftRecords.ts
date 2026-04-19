import { LIFT_RECORD_HEADER_MAP, LiftRecord, SpreadsheetCell } from "@src/core";
/**
 * Converts an array of LiftRecord objects to a 2D array (for writing to a sheet)
 * @param {LiftRecord[]} records
 * @returns {SpreadsheetCell[][]} 2D array with headers in row 0
 */
export function mapLiftRecords(records: LiftRecord[]): SpreadsheetCell[][] {
  const headers = Object.keys(LIFT_RECORD_HEADER_MAP);
  return [
    headers,
    ...records.map((rec) =>
      headers.map((header) => rec[LIFT_RECORD_HEADER_MAP[header]!.key as keyof LiftRecord]),
    ),
  ];
}
