'use server';

import { updateUserSettings } from '@/lib/api';
import type {
  UpdateUserSettingsRequest,
  UserSettingsResponse,
} from '@lifting-logbook/types';

export async function saveSchedule(
  body: UpdateUserSettingsRequest,
): Promise<UserSettingsResponse> {
  return updateUserSettings(body);
}
