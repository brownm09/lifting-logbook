import { LiftRecord } from '@lifting-logbook/core';
import { ILiftRecordRepository } from '../../ports/ILiftRecordRepository';

export class InMemoryLiftRecordRepository implements ILiftRecordRepository {
  constructor(private readonly store: Map<string, LiftRecord[]>) {}

  async getLiftRecords(program: string, cycleNum: number): Promise<LiftRecord[]> {
    return (this.store.get(program) ?? []).filter((r) => r.cycleNum === cycleNum);
  }

  async appendLiftRecords(program: string, records: LiftRecord[]): Promise<void> {
    const existing = this.store.get(program) ?? [];
    this.store.set(program, [...existing, ...records]);
  }

  async updateLiftRecord(
    program: string,
    id: string,
    updates: Partial<Pick<LiftRecord, 'weight' | 'reps' | 'notes'>>,
  ): Promise<LiftRecord | null> {
    const records = this.store.get(program) ?? [];
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
    this.store.set(program, next);
    return updated;
  }
}
