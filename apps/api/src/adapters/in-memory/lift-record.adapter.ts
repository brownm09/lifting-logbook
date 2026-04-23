import { Injectable } from '@nestjs/common';
import { LiftRecord } from '@lifting-logbook/core';
import { ILiftRecordRepository } from '../../ports/ILiftRecordRepository';
import { SEED_PROGRAM, seedLiftRecords } from './fixtures';

@Injectable()
export class InMemoryLiftRecordRepository implements ILiftRecordRepository {
  private recordsByProgram = new Map<string, LiftRecord[]>([
    [SEED_PROGRAM, seedLiftRecords()],
  ]);

  async getLiftRecords(program: string, cycleNum: number): Promise<LiftRecord[]> {
    const records = this.recordsByProgram.get(program) ?? [];
    return records.filter((r) => r.cycleNum === cycleNum);
  }

  async appendLiftRecords(program: string, records: LiftRecord[]): Promise<void> {
    const existing = this.recordsByProgram.get(program) ?? [];
    this.recordsByProgram.set(program, [...existing, ...records]);
  }
}
