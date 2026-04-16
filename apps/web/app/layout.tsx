import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lifting Logbook",
  description: "Track your lifts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
