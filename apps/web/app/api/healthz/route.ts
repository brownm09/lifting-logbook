import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Readiness probe target. Must stay force-dynamic so Next never prerenders
// or edge-caches it — otherwise the failure mode this route exists to detect
// (#382: clerkMiddleware throws on missing CLERK_SECRET_KEY) would be hidden
// from Kubernetes during rollout the same way it was when the probe hit `/`.
export const dynamic = 'force-dynamic';

// Two guards in one handler:
//   1. The route matches Clerk's `/(api|trpc)(.*)` middleware matcher, so a
//      missing CLERK_SECRET_KEY (as in #382) throws inside clerkMiddleware
//      → 500 → fails readiness, before this handler ever runs. That is the
//      primary #382 regression detector.
//   2. The auth() call below additionally verifies clerkMiddleware actually
//      ran on this request — it inspects the `x-clerk-auth-status` header
//      that middleware stamps. If a future matcher edit silently excludes
//      `/api/healthz`, auth() throws "auth header missing" and we 503.
// auth() does NOT re-validate the secret key or make a network call; that
// work already happened in middleware. We deliberately keep the response
// body minimal — no error.message — so a publicly-reachable probe endpoint
// does not leak Clerk misconfiguration details. The original error is still
// logged server-side for operators.
export async function GET() {
  if (process.env.DEV_AUTH_TOKEN) {
    return NextResponse.json({ ok: true, mode: 'dev-auth' });
  }
  try {
    await auth();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Server-side log only (not exposed in the response body, per the note above).
    console.error('[healthz] auth() threw — middleware likely did not run:', err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
