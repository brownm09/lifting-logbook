import { fetchLatestBodyWeight, fetchStrengthGoals, fetchTrainingMaxes } from '@/lib/api';
import { getActiveProgram } from '@/lib/active-program';
import StrengthGoalsForm from './StrengthGoalsForm';

export default async function StrengthGoalsPage() {
  const program = await getActiveProgram();
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
