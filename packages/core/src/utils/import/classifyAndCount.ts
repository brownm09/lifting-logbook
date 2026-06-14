import { ImportWriteResult } from '@lifting-logbook/types';
import { ImportRowKind } from './buildImportPreview';

/**
 * Shared classify-and-count loop for the Smart Import commit path (#532).
 *
 * Every per-kind commit method (training maxes, strength goals, program spec) and
 * every adapter (in-memory + Prisma) walks the incoming rows the same way:
 * collapse duplicate keys within the batch, classify each unique row as
 * create / update / skip against the existing snapshot, apply the write for the
 * non-skip rows, and tally the result. That loop was copy-pasted across the
 * adapters; a change to the dedupe or tally semantics in one place could silently
 * desync the counts another adapter reports. Centralising it here keeps the count
 * contract identical across adapters — the classification *decision* is already
 * shared via the `*RowKind` predicates, this shares the surrounding loop too.
 *
 * `keyOf` produces the per-row dedupe/natural key. `rowKind` decides
 * create/update/skip (typically one of `trainingMaxRowKind` /
 * `strengthGoalRowKind` / `programSpecRowKind`). `applyWrite` performs the write
 * for a non-skip row and is awaited so callers can run it inside a transaction;
 * a throw propagates (the caller's transaction rolls back) and the counts are not
 * advanced for the failed row.
 */
export async function classifyAndCount<T>(
  rows: readonly T[],
  keyOf: (row: T) => string,
  rowKind: (row: T) => ImportRowKind,
  applyWrite: (row: T, kind: 'create' | 'update') => void | Promise<unknown>,
): Promise<ImportWriteResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const key = keyOf(row);
    if (seen.has(key)) continue; // collapse duplicate keys within the batch
    seen.add(key);

    const kind = rowKind(row);
    if (kind === 'skip') {
      skipped++;
      continue;
    }

    await applyWrite(row, kind);
    if (kind === 'create') created++;
    else updated++;
  }

  return { created, updated, skipped };
}
