import { StrengthGoalEntry } from '@lifting-logbook/core';

export interface IStrengthGoalRepository {
  getGoals(program: string): Promise<StrengthGoalEntry[]>;
  upsertGoal(program: string, goal: StrengthGoalEntry): Promise<StrengthGoalEntry>;
  deleteGoal(program: string, lift: string): Promise<void>;
}
