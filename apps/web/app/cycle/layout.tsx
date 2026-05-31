import { UserButton } from '@clerk/nextjs';

export default function CycleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      <header>
        <h1>Lifting Logbook</h1>
        <nav>
          <a href="/history">History</a>
          <a href="/programs">Programs</a>
          <a href="/settings/training-maxes">Settings</a>
        </nav>
        <UserButton afterSignOutUrl="/sign-in" />
      </header>
      {children}
    </main>
  );
}
