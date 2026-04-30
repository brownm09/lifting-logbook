import { fetchTrainingMaxes } from '@/lib/api';
import TrainingMaxesForm from './TrainingMaxesForm';

export default async function TrainingMaxesPage() {
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '531';
  const maxes = await fetchTrainingMaxes(program);
  const lifts = maxes.map((m) => m.lift);

  return <TrainingMaxesForm program={program} lifts={lifts} maxes={maxes} />;
}
