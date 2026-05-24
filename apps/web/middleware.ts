import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

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
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
