// Write operations called directly from the browser (Client Components).
// Auth token is provided by ClerkApiInitializer via setAuthTokenGetter.

import { createApiClient } from '@lifting-logbook/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3004';
const isCloudRun = API_URL.startsWith('https://');
const devToken = !isCloudRun ? process.env.NEXT_PUBLIC_DEV_AUTH_TOKEN : undefined;

type TokenGetter = () => Promise<string | null>;
let _getToken: TokenGetter | null = null;

export function setAuthTokenGetter(fn: TokenGetter): void {
  _getToken = fn;
}

// ---------------------------------------------------------------------------
// AUTH HEADER INVARIANT (browser path) — read before changing this strategy.
//
// Browser -> API calls send the Clerk JWT in `Authorization` (there is no Cloud Run
// IAM hop on the client path, so no header collision). This is the ONLY thing the
// browser wrapper does differently from the server one: every endpoint lives in
// @lifting-logbook/api-client; this module just supplies the strategy below. The
// SERVER path uses a different header (X-Clerk-Authorization) — see lib/api.ts.
// See CONTRIBUTING.md -> API auth headers.
// ---------------------------------------------------------------------------
async function getClientAuthHeaders(): Promise<Record<string, string>> {
  if (devToken) return { Authorization: `Bearer ${devToken}` };
  if (_getToken) {
    const token = await _getToken();
    if (token) return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// Endpoints are defined once in @lifting-logbook/api-client. This module is a thin
// wrapper that binds them to the browser auth strategy above and re-exports the
// subset of write operations invoked from Client Components.
export const {
  createLiftRecord,
  updateLiftRecord,
  rescheduleWorkout,
  skipWorkout,
  unskipWorkout,
  recordBodyWeight,
  upsertLiftOverride,
  patchLiftMetadata,
  deleteLiftOverride,
  importLiftRecords,
  previewImport,
  commitImport,
} = createApiClient({ baseUrl: API_URL, getAuthHeaders: getClientAuthHeaders });
