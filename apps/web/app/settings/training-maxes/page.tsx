import { fetchTrainingMaxes, fetchProgramSpec } from '@/lib/api';
import TrainingMaxesForm from './TrainingMaxesForm';

export default async function TrainingMaxesPage() {
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '531';

  const [maxes, specs] = await Promise.all([
    fetchTrainingMaxes(program),
    fetchProgramSpec(program),
  ]);

  // Derive ordered lift list from spec (unique, preserving first-seen order)
  const seen = new Set<string>();
  const lifts: string[] = [];
  for (const spec of specs) {
    if (!seen.has(spec.lift)) {
      seen.add(spec.lift);
      lifts.push(spec.lift);
    }
  }

  return <TrainingMaxesForm program={program} lifts={lifts} maxes={maxes} />;
}
