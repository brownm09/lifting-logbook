import { StrengthGoalEntry, strengthGoalRowKind } from '@lifting-logbook/core';
import { ImportWriteResult } from '@lifting-logbook/types';
import { IStrengthGoalRepository } from '../../ports/IStrengthGoalRepository';
import { StrengthGoalNotFoundError } from '../../ports/errors';

export class InMemoryStrengthGoalRepository implements IStrengthGoalRepository {
  private readonly store = new Map<string, Map<string, StrengthGoalEntry>>();

  private programMap(program: string): Map<string, StrengthGoalEntry> {
    let m = this.store.get(program);
    if (!m) {
      m = new Map();
      this.store.set(program, m);
    }
    return m;
  }

  async getGoals(program: string): Promise<StrengthGoalEntry[]> {
    return Array.from(this.programMap(program).values());
  }

  async upsertGoal(program: string, goal: StrengthGoalEntry): Promise<StrengthGoalEntry> {
    this.programMap(program).set(goal.lift, goal);
    return goal;
  }

  async importGoals(
    program: string,
    goals: StrengthGoalEntry[],
  ): Promise<ImportWriteResult> {
    const map = this.programMap(program);
    const existingByLift = new Map(map);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const seen = new Set<string>();

    for (const g of goals) {
      if (seen.has(g.lift)) continue; // collapse duplicate lifts within the file
      seen.add(g.lift);

      const kind = strengthGoalRowKind(g, existingByLift);
      if (kind === 'skip') {
        skipped++;
        continue;
      }
      map.set(g.lift, g);
      if (kind === 'create') created++;
      else updated++;
    }

    return { created, updated, skipped };
  }

  async deleteGoal(program: string, lift: string): Promise<void> {
    const m = this.programMap(program);
    if (!m.has(lift)) throw new StrengthGoalNotFoundError(lift);
    m.delete(lift);
  }
}
