'use server';

import { revalidatePath } from 'next/cache';
import { updateUserSettings } from '@/lib/api';
import type { UserSettingsResponse } from '@lifting-logbook/types';

// Server-side boundary: lib/api.ts is 'server-only', so a client component cannot import
// it directly. Mirrors settings/schedule/actions.ts's saveSchedule.
//
// Only accepts a concrete number, not `number | null` — the select in WeightIncrementForm
// always resolves to one of the 4 allowed values (never an "unset" state), so there is no
// client-triggerable path that needs to send `null`. The API/DTO/repository still support an
// explicit `null` to clear the stored override entirely (see update-settings.dto.ts) for
// other callers or future UI; this action just doesn't expose that path today.
export async function saveWeightIncrement(defaultWeightIncrement: number): Promise<UserSettingsResponse> {
  const result = await updateUserSettings({ defaultWeightIncrement });
  revalidatePath('/settings/weight-rounding');
  return result;
}
