'use server';

import { revalidatePath } from 'next/cache';
import { updateUserSettings } from '@/lib/api';
import type { UserSettingsResponse, WeightUnit } from '@lifting-logbook/types';

// Server-side boundary: lib/api.ts is 'server-only', so a client component cannot import
// it directly. Mirrors settings/weight-rounding/actions.ts's saveWeightIncrement.
export async function saveUnit(unit: WeightUnit): Promise<UserSettingsResponse> {
  const result = await updateUserSettings({ unit });
  revalidatePath('/settings/units');
  return result;
}
