import { ImportError } from '@lifting-logbook/types';
import { DEFAULT_SLOT_MAP } from '../../catalog/slotMaps';
import { TrainingMax } from '../../models';

export interface TrainingMaxImportValidationResult {
  /** Rows that passed validation, with lift names resolved to canonical IDs where known. */
  valid: TrainingMax[];
  errors: ImportError[];
}

/**
 * Validates parsed training-max rows, collecting all errors (all-or-nothing
 * semantics mirroring {@link validateLiftImport}). Row numbers are 1-based and
 * exclude the CSV header row.
 *
 * Lift names are resolved through `DEFAULT_SLOT_MAP` when matched (so "Bench P."
 * → "bench-press"); unmatched names are kept verbatim rather than rejected,
 * since training maxes routinely cover lifts outside the built-in templates.
 */
export function validateTrainingMaxImport(
  maxes: TrainingMax[],
  slotMap: Readonly<Record<string, string>> = DEFAULT_SLOT_MAP,
): TrainingMaxImportValidationResult {
  const valid: TrainingMax[] = [];
  const errors: ImportError[] = [];

  maxes.forEach((m, i) => {
    const row = i + 1;
    const rowErrors: ImportError[] = [];

    const liftStr = String(m.lift ?? '').trim();
    if (!liftStr) rowErrors.push({ row, field: 'lift', message: 'lift is empty' });
    if (typeof m.weight !== 'number' || isNaN(m.weight))
      rowErrors.push({ row, field: 'weight', message: 'weight is not a number' });
    if (!m.dateUpdated || isNaN(m.dateUpdated.getTime()))
      rowErrors.push({ row, field: 'dateUpdated', message: 'dateUpdated is invalid' });

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      const resolved = slotMap[liftStr] ?? liftStr;
      valid.push({ ...m, lift: resolved as TrainingMax['lift'] });
    }
  });

  return { valid, errors };
}
