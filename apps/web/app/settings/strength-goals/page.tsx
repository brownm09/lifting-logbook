import { fetchLatestBodyWeight, fetchStrengthGoals, fetchTrainingMaxes } from '@/lib/api';
import StrengthGoalsForm from './StrengthGoalsForm';

export default async function StrengthGoalsPage() {
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  const [maxes, goals, bodyWeight] = await Promise.all([
    fetchTrainingMaxes(program),
    fetchStrengthGoals(program),
    fetchLatestBodyWeight(program),
  ]);

  return (
    <StrengthGoalsForm
      program={program}
      trainingMaxes={maxes}
      goals={goals}
      bodyWeight={bodyWeight}
    />
  );
}
