import 'server-only';

import { DEFAULT_WEIGHT_UNIT } from '@lifting-logbook/types';
import type { WeightUnit } from '@lifting-logbook/types';
import { fetchUserSettings } from './api';

/**
 * The user's preferred weight-display unit, falling back to 'lbs' when unset
 * or when the API is unreachable — never throws. Display preference only;
 * every weight stays stored/compared in its original unit at full precision
 * (see docs/standards/training-max-precision.md).
 */
export async function getPreferredUnit(): Promise<WeightUnit> {
  const settings = await fetchUserSettings().catch(() => null);
  return settings?.unit ?? DEFAULT_WEIGHT_UNIT;
}
