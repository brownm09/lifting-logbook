import { NextResponse } from 'next/server';

// Pure runtime liveness probe for the staging deploy smoke (#402, renamed
// to /livez in #409). Returns 200 iff the Next.js runtime is serving
// requests. Deliberately does NOT touch Clerk, the API, the DB, or any
// downstream dep — the existing /api/healthz route (#395) is the Clerk-init
// regression detector and runs *through* clerkMiddleware; this route is the
// opposite contract and is excluded from the middleware matcher in
// apps/web/middleware.ts so it never enters Clerk.
//
// Route was originally `/healthz` (#402, #404) but Google Frontend on
// Cloud Run intercepts /healthz before it reaches the container — a probe
// of the live staging URL returns Google's branded 404 page, not Next.js's.
// All sibling paths (/livez, /readyz, /health, /healthcheck) pass through
// to Next.js normally; only /healthz is intercepted. The previous bug
// chain (#407 cache poisoning hypothesis; #409 HEAD const-alias and
// middleware matcher hypotheses) were all wrong — the route file, the
// manifest, and the standalone tree were always correct. The /healthz
// path itself is the problem. /livez is the Kubernetes liveness-probe
// convention and is not intercepted by GFE.
//
// force-dynamic prevents Next from prerendering or edge-caching the
// response so the probe always exercises the running runtime rather than
// a frozen build artifact.
export const dynamic = 'force-dynamic';

export async function GET() {
  return new NextResponse('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
}

// HEAD intentionally omitted. The smoke probe uses GET. If a future GCP
// uptime check requires HEAD, add it as a function declaration, not a
// const alias of GET — `export const HEAD = GET` was tested earlier in
// #409 and ruled out as the bug (the actual bug was the /healthz path
// being intercepted by GFE) but const-alias HEAD export remains untested
// against Next.js 16.2.4's runtime, so prefer the function form to avoid
// re-opening that question:
//   export async function HEAD() { ... }
// If re-added, also update apps/web/app/livez/route.test.ts — the
// regression guard there asserts HEAD is undefined and will need to be
// loosened.
