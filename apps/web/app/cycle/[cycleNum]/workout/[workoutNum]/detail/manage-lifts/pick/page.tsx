import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchLiftCatalog } from '@/lib/api';
import LiftPicker from './LiftPicker';
import styles from './pick.module.css';

export default async function LiftPickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleNum: string; workoutNum: string }>;
  searchParams: Promise<{ action?: string; replacing?: string }>;
}) {
  const { cycleNum: cycleNumParam, workoutNum: workoutNumParam } = await params;
  const { action, replacing } = await searchParams;

  const cycleNum = Number(cycleNumParam);
  const workoutNum = Number(workoutNumParam);

  if (!Number.isInteger(cycleNum) || !Number.isInteger(workoutNum) || workoutNum < 1) {
    notFound();
  }

  const validAction = action === 'replace' ? 'replace' : 'add';
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  const catalog = await fetchLiftCatalog(program);

  const backHref = `/cycle/${cycleNum}/workout/${workoutNum}/detail/manage-lifts`;
  const title = validAction === 'replace' ? `Replace ${replacing ?? 'lift'}` : 'Add Lift';

  return (
    <main className={styles.container}>
      <Link href={backHref} className={styles.backLink}>
        ← Back to Manage Lifts
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </header>

      <LiftPicker
        program={program}
        cycleNum={cycleNum}
        workoutNum={workoutNum}
        action={validAction}
        replacing={replacing}
        catalog={catalog}
        backHref={backHref}
      />
    </main>
  );
}
