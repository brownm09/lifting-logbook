import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import type { Metadata } from "next";
import { ClerkApiInitializer } from '@/components/ClerkApiInitializer';
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifting Logbook",
  description: "Track your lifts.",
};

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

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>
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
        </body>
      </html>
    </ClerkProvider>
  );
}
