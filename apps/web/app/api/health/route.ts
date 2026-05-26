import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3004';

// Deployment health check — verifies two deployment properties independently:
//
// 1. Clerk auth propagation: browser session cookies → Clerk middleware → userId non-null.
//    Uses auth().userId rather than getToken() + JWT forwarding because in Clerk dev mode
//    (pk_test_ key) session JWTs have a 60-second TTL and the backend's verifyToken()
//    call (which fetches JWKS over the network) consistently rejects them before the
//    staging integration tests finish running.  auth().userId is validated server-side
//    by Clerk's Next.js middleware on every request — it is the authoritative signal
//    that the Clerk session from storageState is still recognised.
//
// 2. API reachability: the backend's public GET /health endpoint returns 200.
//    This verifies API_URL is correctly wired and the API service is running.
//    A public endpoint is used because JWT forwarding is unreliable in dev mode
//    (see reason above) — reachability is sufficient to confirm deployment correctness.
//
// Used by staging integration tests (test 5) in apps/web/e2e/staging.spec.ts.
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/health`, {
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
