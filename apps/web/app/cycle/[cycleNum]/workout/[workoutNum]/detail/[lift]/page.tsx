import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchTrainingMaxes, fetchTrainingMaxHistory, fetchLiftRecords } from '@/lib/api';
import LiftHistoryFilters from './LiftHistoryFilters';
import styles from './lift.module.css';

export default async function LiftDetailPage({
  params,
}: {
  params: Promise<{ cycleNum: string; workoutNum: string; lift: string }>;
}) {
  const { cycleNum: cycleNumParam, workoutNum: workoutNumParam, lift: liftParam } = await params;
  const cycleNum = Number(cycleNumParam);
  const workoutNum = Number(workoutNumParam);
  const lift = decodeURIComponent(liftParam);

  if (!Number.isInteger(cycleNum) || !Number.isInteger(workoutNum) || workoutNum < 1) {
    notFound();
  }

  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';

  const [maxes, history, allRecords] = await Promise.all([
    fetchTrainingMaxes(program),
    fetchTrainingMaxHistory(program),
    fetchLiftRecords(program),
  ]);

  const currentMax = maxes.find((m) => m.lift === lift);
  const tmHistory = history.entries.filter((e) => e.lift === lift);
  const setHistory = allRecords
    .filter((r) => r.lift === lift)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Unknown lift: no TM, no history, no sets — the URL is invalid or stale.
  if (!currentMax && tmHistory.length === 0 && setHistory.length === 0) {
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

      <h1 className={styles.heading}>{lift}</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Current Training Max</h2>
        {currentMax ? (
          <p className={styles.currentMax}>
            {currentMax.weight} {currentMax.unit}
          </p>
        ) : (
          <p className={styles.empty}>No training max set.</p>
        )}
      </section>

      {tmHistory.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Training Max History</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight</th>
                <th>Reps</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tmHistory
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>
                      {entry.weight} {entry.unit}
                    </td>
                    <td>{entry.reps}</td>
                    <td>{entry.isPR && <span className={styles.prBadge}>PR</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Set History</h2>
        {setHistory.length === 0 ? (
          <p className={styles.empty}>No sets logged yet.</p>
        ) : (
          <LiftHistoryFilters records={setHistory} />
        )}
      </section>
    </main>
  );
}
