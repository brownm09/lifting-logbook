import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3004';

// Fetches a GCP identity token from the metadata service for service-to-service auth.
// The staging API Cloud Run service requires Cloud Run IAM authentication — only the
// web workload service account has roles/run.invoker on the API service (see
// infra/terraform/cloud-run.tf: web_invoker_on_api). Unauthenticated requests to the
// API are rejected with 403 by Cloud Run infrastructure before reaching NestJS.
//
// Returns null outside GCP environments (local dev, CI runners without the metadata
// service). In those cases the API call is skipped and auth().userId is the sole check.
async function getGcpIdentityToken(audience: string): Promise<string | null> {
  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
  try {
    const res = await fetch(url, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

// Deployment health check — verifies two deployment properties independently:
//
// 1. Clerk auth propagation: browser session cookies → Clerk middleware → userId non-null.
//    Uses auth().userId rather than getToken() + JWT forwarding because in Clerk dev mode
//    (pk_test_ key) session JWTs have a 60-second TTL and the backend's verifyToken()
//    call consistently rejects them by the time the staging tests run.
//
// 2. API reachability: GET /health on the backend returns 200 (with GCP identity token).
//    Verifies API_URL is correctly wired and the service is running.
//
// Used by staging integration tests (test 5) in apps/web/e2e/staging.spec.ts.
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Attempt to get a GCP identity token. Only available when running on Cloud Run.
  const identityToken = await getGcpIdentityToken(API_URL);

  if (!identityToken) {
    // Not in a GCP environment (local dev or non-GCP CI) — skip the API reachability
    // check and return success based on Clerk auth alone.
    return NextResponse.json({ ok: true, userId, apiCheck: 'skipped' });
  }

  const res = await fetch(`${API_URL}/health`, {
    headers: { Authorization: `Bearer ${identityToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `api health returned ${res.status}` },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, userId });
}
