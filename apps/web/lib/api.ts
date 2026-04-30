import type {
  CycleDashboardResponse,
  LiftingProgramSpecResponse,
  TrainingMaxResponse,
  WorkoutResponse,
} from '@lifting-logbook/types';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchCycleDashboard(
  program: string,
): Promise<CycleDashboardResponse> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/cycles/current`,
    { cache: 'no-store' },
  );
}

export function fetchProgramSpec(
  program: string,
): Promise<LiftingProgramSpecResponse[]> {
  return apiFetch(`/programs/${encodeURIComponent(program)}/spec`, {
    next: { revalidate: 3600 },
  } as RequestInit);
}

export function fetchTrainingMaxes(
  program: string,
): Promise<TrainingMaxResponse[]> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/training-maxes`,
    { cache: 'no-store' },
  );
}

export function fetchWorkout(
  program: string,
  workoutNum: number,
): Promise<WorkoutResponse> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/workouts/${workoutNum}`,
    { cache: 'no-store' },
  );
}
