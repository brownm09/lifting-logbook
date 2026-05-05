import { fetchTrainingMaxes, fetchTrainingMaxHistory } from '@/lib/api';
import TrainingMaxesForm from './TrainingMaxesForm';
import MaxHistory from './MaxHistory';

export default async function TrainingMaxesPage() {
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  const [maxes, history] = await Promise.all([
    fetchTrainingMaxes(program),
    fetchTrainingMaxHistory(program),
  ]);
  const lifts = maxes.map((m) => m.lift);

  return (
    <>
      <TrainingMaxesForm program={program} lifts={lifts} maxes={maxes} />
      <MaxHistory initialEntries={history.entries} program={program} />
    </>
  );
}
