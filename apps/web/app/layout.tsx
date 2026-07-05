import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import type { Metadata } from "next";
import { ClerkApiInitializer } from '@/components/ClerkApiInitializer';
import { PublicConfigProvider } from '@/components/PublicConfigProvider';
import {
  publicConfigScript,
  readServerClerkPublishableKey,
  readServerPublicConfig,
} from '@/lib/public-config';
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifting Logbook",
  description: "Track your lifts.",
};

// The root layout reads public config from process.env at request time and injects it
// into window.__PUBLIC_CONFIG__ / <ClerkProvider> (see below). Force dynamic rendering so
// those reads happen per request rather than being evaluated once during build-time
// static prerendering — static prerender would bake build-time env values into the
// shipped HTML and defeat the runtime-injection contract this refactor exists to restore
// (#396 / ADR-028). The app is auth-gated and already renders dynamically in practice;
// this makes the requirement explicit and also removes the build-time Clerk publishable
// key that /_not-found prerendering previously required.
export const dynamic = 'force-dynamic';

const themeInitScript =
  "(function(){try{var t=localStorage.getItem('theme');" +
  "if(t!=='navy'&&t!=='iron')t='navy';" +
  "document.documentElement.setAttribute('data-theme',t);}catch(e){" +
  "document.documentElement.setAttribute('data-theme','navy');}})();";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // When DEV_AUTH_TOKEN is set (Playwright CI, local dev-auth mode), the
  // middleware bypasses clerkMiddleware() entirely. Rendering <SignedIn> in
  // that mode would call auth() server-side without middleware having run,
  // which throws and crashes the page tree. Skip the Clerk UI in that mode.
  const devAuthMode = Boolean(process.env.DEV_AUTH_TOKEN);

  // Public config is read here at request time (this is a Server Component) and
  // injected at runtime — NOT baked into the bundle at build time. The inline
  // <head> script populates window.__PUBLIC_CONFIG__ before hydration (consumed by
  // lib/client-api.ts); the same object is passed to <PublicConfigProvider> for
  // React components, and the Clerk publishable key is passed to <ClerkProvider> as
  // a prop (Clerk's runtime-key pattern). See ADR-028 / issue #396.
  const publicConfig = readServerPublicConfig();
  // Fail loud in a deployed runtime if the Clerk publishable key is missing, rather than
  // rendering <ClerkProvider> with an undefined key (auth would break silently in the
  // browser). Matches the API-side guard in apps/api/src/auth/auth.module.ts. See #687.
  const clerkPublishableKey = readServerClerkPublishableKey();

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{ __html: publicConfigScript(publicConfig) }}
          />
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>
          <PublicConfigProvider config={publicConfig}>
            <ClerkApiInitializer />
            {!devAuthMode && (
              <SignedIn>
                <div
                  style={{
                    position: 'fixed',
                    top: '1rem',
                    right: '1rem',
                    zIndex: 50,
                  }}
                >
                  <UserButton afterSignOutUrl="/sign-in" />
                </div>
              </SignedIn>
            )}
            {children}
          </PublicConfigProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
