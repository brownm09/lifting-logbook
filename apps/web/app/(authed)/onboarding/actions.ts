'use server';

import { redirect } from 'next/navigation';
// next/dist internal path — not a public API; validate on Next.js upgrades
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { initializeCycle, updateTrainingMaxes } from '@/lib/api';
import { PROGRAMS } from '@/lib/programs';

export type CreateFirstCycleResult = { ok: false; error: string };

export async function createFirstCycle(
  programId: string,
  maxes: { lift: string; oneRm: number }[] = [],
): Promise<CreateFirstCycleResult | never> {
  const allowed = PROGRAMS.filter((p) => p.available).map((p) => p.id);
  if (!allowed.includes(programId)) {
    return { ok: false, error: 'That program is not yet available.' };
  }
  try {
    await initializeCycle(programId);
    // Persist the confirmed maxes as training maxes (90% of the estimated 1RM,
    // matching the value shown on the Confirm step). Runs after initializeCycle
    // so it overrides any maxes the cycle seeded. The PATCH endpoint merges and
    // appends unknown lifts, so any catalog or custom lift name is accepted.
    if (maxes.length > 0) {
      await updateTrainingMaxes(programId, {
        maxes: maxes.map((m) => ({
          lift: m.lift,
          weight: Math.round(m.oneRm * 0.9),
          unit: 'lbs',
        })),
      });
    }
    redirect('/cycle/1');
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { ok: false, error: 'Failed to start your program. Please try again.' };
  }
}
