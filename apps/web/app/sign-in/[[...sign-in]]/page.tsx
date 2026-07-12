import { SignIn } from '@clerk/nextjs';

// In dev-auth mode (DEV_AUTH_TOKEN set) the root layout intentionally does NOT mount
// <ClerkProvider> (#834), so <SignIn/> — a Clerk client component that requires a
// <ClerkProvider> ancestor — would throw and crash this route. /sign-in is a dead route
// in that mode anyway: middleware.ts bypasses clerkMiddleware() (never redirecting here)
// and app/page.tsx skips its auth() redirect, so nothing routes a user to it. Render a
// short notice instead of crashing. The DEV_AUTH_TOKEN read mirrors the root layout's
// guard and is dynamic (the root layout forces dynamic rendering for the whole tree, so
// this is evaluated per request, not inlined at build time). Real-Clerk mode
// (staging/production or a real local pk_ key) renders <SignIn/> exactly as before.
export default function Page() {
  if (process.env.DEV_AUTH_TOKEN) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <p style={{ maxWidth: '32rem', textAlign: 'center' }}>
          Dev-auth mode is active (<code>DEV_AUTH_TOKEN</code> is set), so Clerk sign-in is
          bypassed and this page is not used. Unset <code>DEV_AUTH_TOKEN</code> and configure
          a real Clerk publishable key to use the sign-in flow.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
      <SignIn />
    </div>
  );
}
