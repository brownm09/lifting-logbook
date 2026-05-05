'use server';

import { updateTrainingMaxes, updateTrainingMaxHistoryEntry } from '@/lib/api';
import type {
  TrainingMaxHistoryEntryResponse,
  TrainingMaxResponse,
  UpdateTrainingMaxesRequest,
} from '@lifting-logbook/types';

export async function saveTrainingMaxes(
  program: string,
  body: UpdateTrainingMaxesRequest,
): Promise<TrainingMaxResponse[]> {
  return updateTrainingMaxes(program, body);
}

export async function toggleHistoryPR(
  program: string,
  id: string,
  isPR: boolean,
): Promise<TrainingMaxHistoryEntryResponse> {
  return updateTrainingMaxHistoryEntry(program, id, { isPR });
}

export async function toggleHistoryGoalMet(
  program: string,
  id: string,
  goalMet: boolean,
): Promise<TrainingMaxHistoryEntryResponse> {
  return updateTrainingMaxHistoryEntry(program, id, { goalMet });
}
