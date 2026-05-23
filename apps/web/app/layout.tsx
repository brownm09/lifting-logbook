import { ClerkProvider } from '@clerk/nextjs';
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
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>
          <ClerkApiInitializer />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
