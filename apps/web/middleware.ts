import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Kubernetes readiness probe — must run through clerkMiddleware (to exercise
  // Clerk init) but must not be redirected to /sign-in. See #385. The `(.*)`
  // suffix matches the sibling sign-in/sign-up patterns and tolerates trailing
  // slashes or future sub-paths without re-opening the original issue.
  '/api/healthz(.*)',
]);

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

// When DEV_AUTH_TOKEN is set, the app uses token-based auth to the mock API
// and Clerk is not active. Skip Clerk middleware entirely in this mode so that
// unauthenticated requests are not redirected to /sign-in.
export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (process.env.DEV_AUTH_TOKEN) {
    return NextResponse.next();
  }
  return clerkHandler(request, event);
}

export const config = {
  // Standard Clerk matcher — excludes static assets (_next, images, fonts, etc.)
  // so the middleware only runs on page and API routes.
  //
  // `healthz` is also negated: the /healthz route (#402) is a pure runtime
  // liveness probe that must NOT enter clerkMiddleware. It is distinct from
  // /api/healthz (#395), which deliberately runs through Clerk to detect
  // init failures — the (api|trpc) line below still captures that one.
  //
  // The healthz(?:[/?]|$) anchor pins the exclusion to /healthz, /healthz/*,
  // and /healthz?... — paths like /healthzfoo and /healthz-admin still enter
  // clerkMiddleware and are auth-protected (#404 original behavior). The
  // narrower `healthz(?:\?|$)` variant from #406 (which excluded /healthz/*
  // from the bypass) appeared to coincide with the runtime route-dispatch
  // 404 documented in #407 and #409; reverting to the #404 anchor as part
  // of the #409 hypothesis-A bisection. The looser anchor does mean any
  // future nested route under /healthz (e.g., /healthz/admin) silently
  // bypasses auth — do not add nested routes under /healthz until #409 is
  // root-caused and a path-segment-aware tightening is restored.
  matcher: [
    '/((?!_next|healthz(?:[/?]|$)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
