import { UserSettingsResponse } from '@lifting-logbook/types';

export interface IUserSettingsRepository {
  getSettings(): Promise<UserSettingsResponse>;
}
