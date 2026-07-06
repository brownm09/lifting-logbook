import 'server-only';
import { cache } from 'react';
import { fetchUserSettings } from './api';

/**
 * Request-cached user-settings fetch. React `cache()` dedupes calls within a
 * single server render, so consumers that each need settings on the same page
 * (e.g. getActiveProgram plus a page that also reads defaultWeightIncrement)
 * share one network round-trip instead of issuing duplicate /user-settings GETs.
 */
export const getUserSettings = cache(fetchUserSettings);

export const getActiveProgram = cache(async (): Promise<string> => {
  try {
    const settings = await getUserSettings();
    return settings.activeProgram ?? process.env.DEFAULT_PROGRAM ?? '5-3-1';
  } catch (e) {
    console.error('getActiveProgram: failed to fetch user settings, falling back to default', e);
    return process.env.DEFAULT_PROGRAM ?? '5-3-1';
  }
});
