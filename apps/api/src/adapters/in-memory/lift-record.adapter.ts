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

  async updateLiftRecord(
    program: string,
    id: string,
    updates: Partial<Pick<LiftRecord, 'weight' | 'reps' | 'notes'>>,
  ): Promise<LiftRecord | null> {
    const records = this.recordsByProgram.get(program) ?? [];
    const idx = records.findIndex(
      (r) => `${r.program}-${r.cycleNum}-${r.workoutNum}-${r.lift}-${r.setNum}` === id,
    );
    if (idx === -1) return null;
    const current = records[idx] as LiftRecord;
    const updated: LiftRecord = {
      ...current,
      weight: updates.weight ?? current.weight,
      reps: updates.reps ?? current.reps,
      notes: updates.notes ?? current.notes,
    };
    const next = [...records];
    next[idx] = updated;
    this.recordsByProgram.set(program, next);
    return updated;
  }
}
