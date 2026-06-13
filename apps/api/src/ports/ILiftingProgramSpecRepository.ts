import { LiftingProgramSpec } from '@lifting-logbook/core';
import { ImportWriteResult } from '@lifting-logbook/types';

/**
 * Counts returned by an idempotent program-spec write. Alias of the shared
 * {@link ImportWriteResult} so every import-commit kind reports the same shape.
 */
export type SaveProgramSpecResult = ImportWriteResult;

export interface ILiftingProgramSpecRepository {
  getProgramSpec(program: string): Promise<LiftingProgramSpec[]>;

  /**
   * Idempotently writes program-spec rows for a **custom** program, keyed by
   * (week, offset, lift, order): a new key inserts, an existing key with changed
   * config updates, an identical key is skipped. Re-running the same import
   * yields `created: 0`.
   *
   * Built-in template programs are immutable seed data — implementations throw
   * when `program` is not a custom (UUID) program id.
   */
  saveProgramSpec(
    program: string,
    rows: LiftingProgramSpec[],
  ): Promise<SaveProgramSpecResult>;
}
