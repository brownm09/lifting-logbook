import { StrengthGoalEntry } from '@lifting-logbook/core';
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

  async deleteGoal(program: string, lift: string): Promise<void> {
    const m = this.programMap(program);
    if (!m.has(lift)) throw new StrengthGoalNotFoundError(lift);
    m.delete(lift);
  }
}
