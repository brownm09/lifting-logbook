import { redirect } from 'next/navigation';
import { fetchCycleDashboard } from '@/lib/api';
import { getActiveProgram } from '@/lib/active-program';

export default async function CyclePage() {
  const program = await getActiveProgram();
  const dashboard = await fetchCycleDashboard(program);
  if (!dashboard) redirect('/onboarding');
  redirect(`/cycle/${dashboard.cycleNum}`);
}
