import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchWorkout } from '@/lib/api';
import ManageLiftsActions from './ManageLiftsActions';
import styles from './manage-lifts.module.css';

export default async function ManageLiftsPage({
  params,
}: {
  params: Promise<{ cycleNum: string; workoutNum: string }>;
}) {
  const { cycleNum: cycleNumParam, workoutNum: workoutNumParam } = await params;
  const cycleNum = Number(cycleNumParam);
  const workoutNum = Number(workoutNumParam);

  if (!Number.isInteger(cycleNum) || !Number.isInteger(workoutNum) || workoutNum < 1) {
    notFound();
  }

  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  const workout = await fetchWorkout(program, workoutNum);

  if (!workout) {
    notFound();
  }

  return (
    <main className={styles.container}>
      <Link
        href={`/cycle/${cycleNum}/workout/${workoutNum}/detail`}
        className={styles.backLink}
      >
        ← Back to Workout
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Manage Lifts</h1>
        <p className={styles.subtitle}>Week {workout.week} — Workout {workoutNum}</p>
      </header>

      <section className={styles.liftsSection}>
        <ManageLiftsActions
          program={program}
          cycleNum={cycleNum}
          workoutNum={workoutNum}
          lifts={workout.lifts}
        />
      </section>

      <div className={styles.addLift}>
        <Link
          href={`/cycle/${cycleNum}/workout/${workoutNum}/detail/manage-lifts/pick?action=add`}
          className={styles.btnPrimary}
        >
          + Add Lift
        </Link>
      </div>
    </main>
  );
}
