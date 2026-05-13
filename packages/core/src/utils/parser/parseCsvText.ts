import { parse } from 'csv-parse/sync';
import { SpreadsheetCell } from '../../models';

/**
 * Parses a raw CSV string into a 2D array of SpreadsheetCells.
 * The first row is treated as the header row (same convention as parseLiftRecords).
 */
export function parseCsvText(text: string): SpreadsheetCell[][] {
  return parse(text, { skip_empty_lines: true }) as SpreadsheetCell[][];
}
