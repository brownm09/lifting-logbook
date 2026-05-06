import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchWorkout, fetchProgramSpec, fetchTrainingMaxes } from '@/lib/api';
import { computePlannedSets } from '@/lib/workoutPlan';
import RescheduleForm from './RescheduleForm';
import styles from './detail.module.css';

function workoutStatus(
  date: string,
  hasLogs: boolean,
): 'completed' | 'upcoming' | 'missed' {
  const today = new Date().toISOString().slice(0, 10);
  if (hasLogs) return 'completed';
  if (date < today) return 'missed';
  return 'upcoming';
}

export default async function WorkoutDetailPage({
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

  const [workout, specs, maxes] = await Promise.all([
    fetchWorkout(program, workoutNum),
    fetchProgramSpec(program),
    fetchTrainingMaxes(program),
  ]);

  if (!workout) {
    notFound();
    return null;
  }

  const effectiveDate = workout.overrideDate ?? workout.date;
  const hasLogs = workout.lifts.some((l) => !l.planned);
  const status = workoutStatus(effectiveDate, hasLogs);
  const maxMap = new Map(maxes.map((m) => [m.lift, m.weight]));

  // For each lift, compute warm-up and work set counts from spec
  const liftDetails = workout.lifts.map((wl) => {
    const spec = specs.find((s) => s.week === workout.week && s.lift === wl.lift);
    const plannedSets = spec ? computePlannedSets(spec, maxMap.get(wl.lift) ?? 0) : [];
    const warmUpCount = plannedSets.filter((s) => s.setLabel.startsWith('Warm-up')).length;
    const workCount = plannedSets.filter((s) => s.setLabel.startsWith('Set')).length;
    return { lift: wl.lift, warmUpCount, workCount };
  });

  const statusLabel =
    status === 'completed' ? '✓ Done' : status === 'upcoming' ? 'Upcoming' : 'Missed';

  return (
    <main className={styles.container}>
      <Link href={`/cycle/${cycleNum}`} className={styles.backLink}>
        ← Back to Cycle
      </Link>

      <header className={styles.header}>
        <div className={styles.headerMeta}>
          <time dateTime={effectiveDate} className={styles.date}>
            {effectiveDate}
            {workout.overrideDate && (
              <span className={styles.rescheduled}> (rescheduled)</span>
            )}
          </time>
          <span className={styles.weekLabel}>Week {workout.week}</span>
        </div>
        <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
          {statusLabel}
        </span>
      </header>

      <section className={styles.liftsSection}>
        <h2 className={styles.sectionHeading}>Planned Lifts</h2>
        <ul className={styles.liftList}>
          {liftDetails.map(({ lift, warmUpCount, workCount }) => (
            <li key={lift} className={styles.liftItem}>
              <Link
                href={`/cycle/${cycleNum}/workout/${workoutNum}/detail/${encodeURIComponent(lift)}`}
                className={styles.liftLink}
              >
                <span className={styles.liftName}>{lift}</span>
                <span className={styles.liftSummary}>
                  {warmUpCount} warm-up • {workCount} working
                </span>
                <span className={styles.liftArrow} aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.actions}>
        <Link
          href={`/cycle/${cycleNum}/workout/${workoutNum}/detail/manage-lifts`}
          className={styles.btnSecondary}
        >
          ✏️ Manage Lifts
        </Link>
        {status !== 'completed' && (
          <Link
            href={`/cycle/${cycleNum}/workout/${workoutNum}`}
            className={styles.btnPrimary}
          >
            Start Logging
          </Link>
        )}
        <RescheduleForm
          program={program}
          cycleNum={cycleNum}
          workoutNum={workoutNum}
          currentDate={effectiveDate}
        />
      </section>
    </main>
  );
}
