import 'server-only';

import { GoogleAuth } from 'google-auth-library';
import type {
  BodyWeightResponse,
  CreateLiftRecordRequest,
  CycleDashboardResponse,
  LiftingProgramSpecResponse,
  LiftRecordResponse,
  RecordBodyWeightRequest,
  TrainingMaxResponse,
  UpdateLiftRecordRequest,
  UpdateTrainingMaxesRequest,
  WorkoutResponse,
} from '@lifting-logbook/types';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const isCloudRun = API_URL.startsWith('https://');

let _auth: GoogleAuth | undefined;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!isCloudRun) return {};
  try {
    _auth ??= new GoogleAuth();
    const client = await _auth.getIdTokenClient(API_URL);
    return (await client.getRequestHeaders()) as Record<string, string>;
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders, ...(init?.headers as Record<string, string> | undefined) },
  });
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

export function updateTrainingMaxes(
  program: string,
  body: UpdateTrainingMaxesRequest,
): Promise<TrainingMaxResponse[]> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/training-maxes`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    } as RequestInit,
  );
}

export async function fetchWorkout(
  program: string,
  workoutNum: number,
): Promise<WorkoutResponse | null> {
  const path = `/programs/${encodeURIComponent(program)}/workouts/${workoutNum}`;
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: authHeaders,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<WorkoutResponse>;
}

export function fetchLiftRecords(
  program: string,
): Promise<LiftRecordResponse[]> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/lift-records`,
    { cache: 'no-store' },
  );
}

export function createLiftRecord(
  program: string,
  body: CreateLiftRecordRequest,
): Promise<LiftRecordResponse> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/lift-records`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
}

export function updateLiftRecord(
  program: string,
  id: string,
  body: UpdateLiftRecordRequest,
): Promise<LiftRecordResponse> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/lift-records/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
}

export function recordBodyWeight(
  program: string,
  body: RecordBodyWeightRequest,
): Promise<void> {
  return apiFetch(
    `/programs/${encodeURIComponent(program)}/body-weight`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
}

export async function fetchLatestBodyWeight(
  program: string,
): Promise<BodyWeightResponse | null> {
  const path = `/programs/${encodeURIComponent(program)}/body-weight/latest`;
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: authHeaders,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<BodyWeightResponse>;
}
