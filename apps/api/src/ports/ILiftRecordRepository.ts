import { LiftRecord } from '@lifting-logbook/core';

export interface ILiftRecordRepository {
  getLiftRecords(program: string, cycleNum: number): Promise<LiftRecord[]>;

  appendLiftRecords(program: string, records: LiftRecord[]): Promise<void>;

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
