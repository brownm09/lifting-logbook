// Write operations called directly from the browser (Client Components).
// Auth token is provided by ClerkApiInitializer via setAuthTokenGetter.

import type {
  CreateLiftOverrideRequest,
  ImportError,
  ImportLiftRecordsResponse,
  LiftMetadataResponse,
  LiftOverrideResponse,
  CreateLiftRecordRequest,
  LiftRecordResponse,
  PatchLiftMetadataRequest,
  RecordBodyWeightRequest,
  UpdateLiftRecordRequest,
} from '@lifting-logbook/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3004';
const isCloudRun = API_URL.startsWith('https://');
const devToken = !isCloudRun ? process.env.NEXT_PUBLIC_DEV_AUTH_TOKEN : undefined;

type TokenGetter = () => Promise<string | null>;
let _getToken: TokenGetter | null = null;

export function setAuthTokenGetter(fn: TokenGetter): void {
  _getToken = fn;
}

async function getClientAuthHeaders(): Promise<Record<string, string>> {
  if (devToken) return { Authorization: `Bearer ${devToken}` };
  if (_getToken) {
    const token = await _getToken();
    if (token) return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getClientAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} for ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function createLiftRecord(
  program: string,
  body: CreateLiftRecordRequest,
): Promise<LiftRecordResponse> {
  return clientFetch(
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
  return clientFetch(
    `/programs/${encodeURIComponent(program)}/lift-records/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
}

export function rescheduleWorkout(
  program: string,
  cycleNum: number,
  workoutNum: number,
  newDate: string,
): Promise<void> {
  return clientFetch<void>(
    `/programs/${encodeURIComponent(program)}/cycles/${cycleNum}/workouts/${workoutNum}/reschedule`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newDate }),
      cache: 'no-store',
    },
  );
}

export function skipWorkout(
  program: string,
  cycleNum: number,
  workoutNum: number,
  reason?: string,
): Promise<void> {
  return clientFetch<void>(
    `/programs/${encodeURIComponent(program)}/cycles/${cycleNum}/workouts/${workoutNum}/skip`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason !== undefined ? { reason } : {}),
      cache: 'no-store',
    },
  );
}

export function unskipWorkout(
  program: string,
  cycleNum: number,
  workoutNum: number,
): Promise<void> {
  return clientFetch<void>(
    `/programs/${encodeURIComponent(program)}/cycles/${cycleNum}/workouts/${workoutNum}/skip`,
    { method: 'DELETE', cache: 'no-store' },
  );
}

export function recordBodyWeight(
  program: string,
  body: RecordBodyWeightRequest,
): Promise<void> {
  return clientFetch(
    `/programs/${encodeURIComponent(program)}/body-weight`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
}

export function upsertLiftOverride(
  program: string,
  cycleNum: number,
  workoutNum: number,
  body: CreateLiftOverrideRequest,
): Promise<LiftOverrideResponse> {
  return clientFetch(
    `/programs/${encodeURIComponent(program)}/cycles/${cycleNum}/workouts/${workoutNum}/lift-overrides`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
}

export function patchLiftMetadata(
  lift: string,
  body: PatchLiftMetadataRequest,
): Promise<LiftMetadataResponse> {
  return clientFetch<LiftMetadataResponse>(
    `/lifts/${encodeURIComponent(lift)}/metadata`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
}

export function deleteLiftOverride(
  program: string,
  cycleNum: number,
  workoutNum: number,
  lift: string,
): Promise<void> {
  return clientFetch<void>(
    `/programs/${encodeURIComponent(program)}/cycles/${cycleNum}/workouts/${workoutNum}/lift-overrides/${encodeURIComponent(lift)}`,
    { method: 'DELETE', cache: 'no-store' },
  );
}

/**
 * Uploads a CSV file to the lift records import endpoint.
 * Returns a discriminated union so callers can handle validation errors gracefully
 * without catching exceptions.
 */
export async function importLiftRecords(
  program: string,
  file: File,
): Promise<
  { ok: true; data: ImportLiftRecordsResponse } | { ok: false; errors: ImportError[] }
> {
  const authHeaders = await getClientAuthHeaders();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_URL}/programs/${encodeURIComponent(program)}/lift-records/import`,
    { method: 'POST', body: form, headers: authHeaders },
  );
  if (res.status === 201) {
    return { ok: true, data: (await res.json()) as ImportLiftRecordsResponse };
  }
  const body = (await res.json()) as { errors?: ImportError[] };
  return {
    ok: false,
    errors: body.errors ?? [{ row: 0, message: `Unexpected error (HTTP ${res.status})` }],
  };
}
