import { NextResponse } from 'next/server';

// Deployment identity probe (#671): reports the git commit this container is
// running, mirroring apps/api's GET /version. GIT_SHA is baked into the image
// at Docker build time (apps/web/Dockerfile's runner stage) — a property of
// the build, not the environment, so unlike the runtime-injected config in
// lib/public-config.ts (ADR-028) it's safe to bake in rather than inject at
// deploy time: it never differs per destination for a given build. A missing
// GIT_SHA only degrades observability, not functionality, so this degrades to
// 'unknown' rather than throwing.
//
// Deliberately mirrors /livez, not /api/healthz: this is a pure,
// unauthenticated probe excluded from clerkMiddleware entirely (see the
// `version` exclusion in apps/web/middleware.ts), unlike /api/healthz which
// deliberately runs through Clerk to test its own init.
//
// force-dynamic prevents Next from prerendering or edge-caching the
// response so the probe always reflects the running container, not a frozen
// build artifact.
export const dynamic = 'force-dynamic';

// Exported (not just local) so route.test.ts can exercise the fallback logic
// directly by passing an explicit value, rather than mutating the global
// process.env.NODE_ENV — Next.js treats that as read-only at runtime (not
// just in its TS types), so tests can't reliably override it. Mirrors the
// signature of apps/api/src/otel.ts's resolveDeploymentEnvironment.
export function resolveEnvironment(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  return nodeEnv && nodeEnv.trim() !== '' ? nodeEnv.trim() : 'development';
}

export async function GET() {
  return NextResponse.json({
    gitSha: process.env.GIT_SHA ?? 'unknown',
    environment: resolveEnvironment(),
  });
}
