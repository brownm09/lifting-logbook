import { LiftRecord } from '@lifting-logbook/core';

export interface ILiftRecordRepository {
  getLiftRecords(program: string, cycleNum: number): Promise<LiftRecord[]>;

  /**
   * Appends records for a program, silently skipping any whose natural key already exists.
   * Returns the number of rows actually inserted (i.e. excluding duplicates).
   */
  appendLiftRecords(program: string, records: LiftRecord[]): Promise<number>;

  /**
   * Returns the subset of `candidates` whose natural key
   * (cycleNum, workoutNum, lift, setNum) already exists for the given program.
   * Used by the CSV import endpoint to identify which rows will be skipped as duplicates.
   */
  findExistingRecords(program: string, candidates: LiftRecord[]): Promise<LiftRecord[]>;

  updateLiftRecord(
    program: string,
    id: string,
    updates: Partial<Pick<LiftRecord, 'weight' | 'reps' | 'notes'>>,
  ): Promise<LiftRecord | null>;
}
