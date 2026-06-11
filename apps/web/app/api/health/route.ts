import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGcpIdentityToken } from '@/lib/gcp-identity-token';

const API_URL = process.env.API_URL ?? 'http://localhost:3004';

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

  /* eslint-disable lifting-logbook/no-raw-fetch-outside-api-client --
     Deliberate exception: this deployment probe calls the backend /health directly with a
     GCP identity token for Cloud Run IAM *only* — it intentionally omits Clerk JWT forwarding
     (see the comment above re: dev-mode JWT TTL). Routing through the typed api-client would
     add X-Clerk-Authorization and change the auth semantics this probe specifically verifies. */
  const res = await fetch(`${API_URL}/health`, {
    headers: { Authorization: `Bearer ${identityToken}` },
    cache: 'no-store',
  });
  /* eslint-enable lifting-logbook/no-raw-fetch-outside-api-client */

  if (!res.ok) {
    return NextResponse.json(
      { error: `api health returned ${res.status}` },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, userId });
}
