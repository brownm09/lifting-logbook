'use server';

import { redirect } from 'next/navigation';
// next/dist internal path — not a public API; validate on Next.js upgrades
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { initializeCycle, updateTrainingMaxes } from '@/lib/api';
import { PROGRAMS } from '@/lib/programs';

export type CreateFirstCycleResult = { ok: false; error: string };

export async function createFirstCycle(
  programId: string,
  maxes: { lift: string; trainingMax: number }[] = [],
): Promise<CreateFirstCycleResult | never> {
  const allowed = PROGRAMS.filter((p) => p.available).map((p) => p.id);
  if (!allowed.includes(programId)) {
    return { ok: false, error: 'That program is not yet available.' };
  }
  try {
    await initializeCycle(programId);
    // Persist the confirmed training maxes exactly as shown on the Confirm step.
    // The caller (OnboardingFlow) already resolved each lift to its final training
    // max — deriving it at 90% of the 1RM for the estimate/test/manual methods, or
    // taking the entered value as-is for the "enter training maxes" method — so this
    // action persists the value verbatim and does no further adjustment. Runs after
    // initializeCycle so it overrides any maxes the cycle seeded. The PATCH endpoint
    // merges and appends unknown lifts, so any catalog or custom lift name is accepted.
    //
    // Best-effort by design: initializeCycle has already created the cycle, so a
    // max-persistence failure must not strand the user on the program-selection
    // step with a cycle that exists but is unreachable from this flow. Training
    // maxes are editable later in settings, so we log and proceed to the cycle
    // rather than failing the whole flow.
    //
    // Error-fallback coverage (docs/standards/error-fallback-test-coverage.md,
    // option c): the catch below intentionally swallows the PATCH error after
    // logging it server-side; the success path (maxes reach updateTrainingMaxes)
    // is asserted in OnboardingFlow.test.tsx, and the swallow only changes
    // post-cycle-creation behavior, which has no client-visible data to assert.
    if (maxes.length > 0) {
      try {
        await updateTrainingMaxes(programId, {
          maxes: maxes.map((m) => ({
            lift: m.lift,
            weight: m.trainingMax,
            unit: 'lbs',
          })),
        });
      } catch (maxErr) {
        console.error(
          `createFirstCycle: cycle initialized for "${programId}" but persisting training maxes failed; continuing to /cycle/1`,
          maxErr,
        );
      }
    }
    redirect('/cycle/1');
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { ok: false, error: 'Failed to start your program. Please try again.' };
  }
}
