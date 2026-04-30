'use server';

import { updateTrainingMaxes } from '@/lib/api';
import type { TrainingMaxResponse, UpdateTrainingMaxesRequest } from '@lifting-logbook/types';

export async function saveTrainingMaxes(
  program: string,
  body: UpdateTrainingMaxesRequest,
): Promise<TrainingMaxResponse[]> {
  return updateTrainingMaxes(program, body);
}
