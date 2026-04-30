import { redirect } from 'next/navigation';
import { fetchCycleDashboard } from '@/lib/api';

export default async function CyclePage() {
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '531';
  const dashboard = await fetchCycleDashboard(program);
  redirect(`/cycle/${dashboard.cycleNum}`);
}
