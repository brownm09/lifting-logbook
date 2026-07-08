import type { Metadata } from 'next';
import type { CustomProgramSummaryResponse } from '@lifting-logbook/types';
import { fetchCustomPrograms } from '@/lib/api';
import { getPreferredUnit } from '@/lib/preferences';
import { ImportWizard } from './ImportWizard';

export const metadata: Metadata = {
  title: 'Import — Lifting Logbook',
  description: 'Import any CSV — lift history, training maxes, strength goals, or a program.',
};

export default async function ImportPage() {
  // The program-picker on the Source step lists the user's custom programs (the
  // realistic import target for a migrating user; program-spec import requires a
  // custom program anyway). On fetch failure we render with an empty list so the
  // wizard shows its "create a program first" guidance rather than crashing; the
  // failure is logged so the upstream fetch problem stays observable.
  let programs: CustomProgramSummaryResponse[];
  try {
    programs = await fetchCustomPrograms();
  } catch (e) {
    console.error('ImportPage: custom programs fetch failed, rendering empty picker', e);
    programs = [];
  }
  const unit = await getPreferredUnit();

  return <ImportWizard programs={programs} unit={unit} />;
}
