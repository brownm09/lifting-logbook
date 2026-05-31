import Link from 'next/link';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      <header>
        <h1>Settings</h1>
        <nav>
          <Link href="/cycle">← Back to cycle</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
