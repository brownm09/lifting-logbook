'use server';

import { redirect } from 'next/navigation';
// next/dist internal path — not a public API; validate on Next.js upgrades
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { initializeCycle } from '@/lib/api';
import { PROGRAMS } from './programs';

export type CreateFirstCycleResult = { ok: false; error: string };

export async function createFirstCycle(
  programId: string,
): Promise<CreateFirstCycleResult | never> {
  const allowed = PROGRAMS.filter((p) => p.available).map((p) => p.id);
  if (!allowed.includes(programId)) {
    return { ok: false, error: 'That program is not yet available.' };
  }
  try {
    await initializeCycle(programId);
    redirect('/cycle/1');
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { ok: false, error: 'Failed to start your program. Please try again.' };
  }
}
