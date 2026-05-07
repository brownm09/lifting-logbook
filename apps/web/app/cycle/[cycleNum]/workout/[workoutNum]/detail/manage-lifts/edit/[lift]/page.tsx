import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchLiftMetadata } from '@/lib/api';
import LiftEditor from '@/components/LiftEditor';

export default async function EditLiftPage({
  params,
}: {
  params: Promise<{ cycleNum: string; workoutNum: string; lift: string }>;
}) {
  const { cycleNum: cycleNumParam, workoutNum: workoutNumParam, lift: liftParam } = await params;
  const cycleNum = Number(cycleNumParam);
  const workoutNum = Number(workoutNumParam);

  if (!Number.isInteger(cycleNum) || !Number.isInteger(workoutNum) || workoutNum < 1) {
    notFound();
  }

  const lift = decodeURIComponent(liftParam);
  const metadata = await fetchLiftMetadata(lift);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <Link
        href={`/cycle/${cycleNum}/workout/${workoutNum}/detail/manage-lifts`}
        style={{ fontSize: '0.875rem', color: 'var(--color-primary, #0070f3)', textDecoration: 'none' }}
      >
        ← Back to Manage Lifts
      </Link>

      <h1 style={{ marginTop: '1rem', marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>
        Edit Lift: {lift}
      </h1>

      <LiftEditor
        cycleNum={cycleNum}
        workoutNum={workoutNum}
        initialMetadata={metadata}
      />
    </main>
  );
}
