import 'server-only';
import { cache } from 'react';
import { fetchUserSettings } from './api';

export const getActiveProgram = cache(async (): Promise<string> => {
  try {
    const settings = await fetchUserSettings();
    return settings.activeProgram ?? process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  } catch (e) {
    console.error('getActiveProgram: failed to fetch user settings, falling back to default', e);
    return process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  }
});
