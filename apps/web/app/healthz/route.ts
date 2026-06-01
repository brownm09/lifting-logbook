import { NextResponse } from 'next/server';

// Pure runtime liveness probe for the staging deploy smoke (#402). Returns 200
// iff the Next.js runtime is serving requests. Deliberately does NOT touch
// Clerk, the API, the DB, or any downstream dep — the existing /api/healthz
// route (#395) is the Clerk-init regression detector and runs *through*
// clerkMiddleware; this route is the opposite contract and is excluded from
// the middleware matcher in apps/web/middleware.ts so it never enters Clerk.
//
// force-dynamic prevents Next from prerendering or edge-caching the response,
// so the probe always exercises the running runtime rather than a frozen build
// artifact.
export const dynamic = 'force-dynamic';

export function GET() {
  return new NextResponse('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
}
