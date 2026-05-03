// Write operations called directly from the browser (Client Components).
// These do not carry GCP identity tokens — browser code cannot obtain them.
// In Cloud Run environments, browser-to-API auth is handled separately (e.g., JWT/Clerk).

import type {
  CreateLiftRecordRequest,
  LiftRecordResponse,
  RecordBodyWeightRequest,
  UpdateLiftRecordRequest,
} from '@lifting-logbook/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} for ${path}`);
  }
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
