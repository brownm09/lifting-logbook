import { StrengthGoalEntry } from '@lifting-logbook/core';
import { ImportWriteResult } from '@lifting-logbook/types';

export interface IStrengthGoalRepository {
  getGoals(program: string): Promise<StrengthGoalEntry[]>;
  upsertGoal(program: string, goal: StrengthGoalEntry): Promise<StrengthGoalEntry>;
  deleteGoal(program: string, lift: string): Promise<void>;

  /**
   * Smart Import commit (#488): atomically upsert `goals` by lift and return the
   * own `{created, updated, skipped}` counts of the write. Replaces the previous
   * per-row `await upsertGoal(...)` loop, which had no surrounding transaction —
   * a row failing mid-loop left earlier rows written. The whole batch now runs in
   * one transaction; a partial failure rolls back. Duplicate lifts within the
   * batch collapse to the first occurrence (matching the preview).
   */
  importGoals(program: string, goals: StrengthGoalEntry[]): Promise<ImportWriteResult>;
}
