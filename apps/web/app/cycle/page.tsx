import { redirect } from 'next/navigation';
import { fetchCycleDashboard } from '@/lib/api';
import { getActiveProgram } from '@/lib/active-program';
import type { CycleDashboardResponse } from '@lifting-logbook/types';

export default async function CyclePage() {
  const program = await getActiveProgram();

  let dashboard: CycleDashboardResponse | null;
  try {
    dashboard = await fetchCycleDashboard(program);
  } catch {
    // API unavailable or auth token expired — redirect to onboarding rather than
    // crashing the server component and leaving the URL stuck at /cycle.
    redirect('/onboarding');
  }

  if (!dashboard) redirect('/onboarding');
  redirect(`/cycle/${dashboard.cycleNum}`);
}
