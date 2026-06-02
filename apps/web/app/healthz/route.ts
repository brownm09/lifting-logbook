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

export async function GET() {
  return new NextResponse('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
}

// HEAD intentionally omitted (#409). Until 2026-06-01 this file exported
// `export const HEAD = GET;` for GCP uptime checks (#405). When the
// staging.yml smoke probe started hitting `/healthz` on main builds after
// #406 merged, the route returned 404 — even though `app-paths-manifest.json`
// listed `/healthz/route` and the standalone tree carried `route.js` (#408's
// build-time assertion confirmed this; #409 diagnostic dump confirmed
// identical manifests pre- vs post-standalone). The const-alias `HEAD = GET`
// passes Next.js 16.2.4 static analysis (the route appears in the manifest)
// but breaks runtime route dispatch for GET as well — both HEAD and GET to
// /healthz return 404. Removing the HEAD export restores GET. The smoke
// probe uses GET (`curl -s -o /dev/null -w '%{http_code}' /healthz`), so
// HEAD is unnecessary for the contract this route exists to satisfy. If a
// future GCP uptime check requires HEAD, add it as a function declaration:
//   export async function HEAD() { ... }
// not a const alias. If re-added, also update
// apps/web/app/healthz/route.test.ts — the regression guard there asserts
// HEAD is undefined and will need to be loosened to "is a function, not a
// const alias of GET" or similar.
