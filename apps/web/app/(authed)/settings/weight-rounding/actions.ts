'use server';

import { revalidatePath } from 'next/cache';
import { updateUserSettings } from '@/lib/api';
import type { UserSettingsResponse } from '@lifting-logbook/types';

// Server-side boundary: lib/api.ts is 'server-only', so a client component cannot import
// it directly. Mirrors settings/schedule/actions.ts's saveSchedule.
export async function saveWeightIncrement(defaultWeightIncrement: number): Promise<UserSettingsResponse> {
  const result = await updateUserSettings({ defaultWeightIncrement });
  revalidatePath('/settings/weight-rounding');
  return result;
}
