import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifting Logbook",
  description: "Track your lifts.",
};

const themeInitScript =
  "(function(){try{var t=localStorage.getItem('theme')||'navy';" +
  "document.documentElement.setAttribute('data-theme',t);}catch(e){" +
  "document.documentElement.setAttribute('data-theme','navy');}})();";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
