'use server';

import { deleteStrengthGoal, upsertStrengthGoal } from '@/lib/api';
import type { StrengthGoalResponse, UpsertStrengthGoalRequest } from '@lifting-logbook/types';

export async function saveStrengthGoal(
  program: string,
  lift: string,
  body: UpsertStrengthGoalRequest,
): Promise<StrengthGoalResponse> {
  return upsertStrengthGoal(program, lift, body);
}

export async function removeStrengthGoal(
  program: string,
  lift: string,
): Promise<void> {
  return deleteStrengthGoal(program, lift);
}
