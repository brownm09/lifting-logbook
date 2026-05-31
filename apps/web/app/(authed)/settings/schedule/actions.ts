'use server';

import { revalidatePath } from 'next/cache';
import { updateUserSettings } from '@/lib/api';
import type {
  UpdateUserSettingsRequest,
  UserSettingsResponse,
} from '@lifting-logbook/types';

// Server-side boundary: lib/api.ts is 'server-only', so a client component cannot import
// it directly. This action lets ScheduleForm reach the API while keeping auth-token
// acquisition (and any future server-only logic) off the wire.
export async function saveSchedule(
  body: UpdateUserSettingsRequest,
): Promise<UserSettingsResponse> {
  const result = await updateUserSettings(body);
  revalidatePath('/settings/schedule');
  return result;
}
