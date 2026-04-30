export default function CycleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      <header>
        <h1>Lifting Logbook</h1>
      </header>
      {children}
    </main>
  );
}
