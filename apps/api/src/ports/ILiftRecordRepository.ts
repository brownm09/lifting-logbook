import { LiftRecord } from '@lifting-logbook/core';

export interface ILiftRecordRepository {
  getLiftRecords(program: string, cycleNum: number): Promise<LiftRecord[]>;

  appendLiftRecords(program: string, records: LiftRecord[]): Promise<void>;
}
