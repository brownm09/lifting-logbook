import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { fetchCycleDashboard, fetchProgramSpec } from '@/lib/api';
import { deriveProgramSummary } from '@/lib/programPlan';
import styles from './program.module.css';

export default async function CycleProgramPage({
  params,
}: {
  params: Promise<{ cycleNum: string }>;
}) {
  const { cycleNum: cycleNumParam } = await params;
  const requestedCycleNum = Number.parseInt(cycleNumParam, 10);
  if (Number.isNaN(requestedCycleNum) || requestedCycleNum < 1) notFound();
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';

  const [dashboard, specs] = await Promise.all([
    fetchCycleDashboard(program),
    fetchProgramSpec(program),
  ]);

  if (dashboard.cycleNum !== requestedCycleNum) {
    redirect(`/cycle/${dashboard.cycleNum}/program`);
  }

  const { durationWeeks, frequency, exercises, warmUpSets, workingSets } =
    deriveProgramSummary(specs);

  return (
    <section className={styles.container}>
      <div className={styles.backRow}>
        <Link href={`/cycle/${dashboard.cycleNum}`}>← Back to Cycle</Link>
      </div>

      <div className={styles.header}>
        <h2 className={styles.heading}>{program}</h2>
        <button type="button" className={styles.editButton} disabled title="Coming soon">
          Edit Program
        </button>
      </div>

      <dl className={styles.dataList}>
        <div className={styles.dataRow}>
          <dt>Duration</dt>
          <dd>{durationWeeks} weeks</dd>
        </div>
        <div className={styles.dataRow}>
          <dt>Frequency</dt>
          <dd>{frequency}× / week</dd>
        </div>
        <div className={styles.dataRow}>
          <dt>Current week type</dt>
          <dd className={styles[`weekType_${dashboard.currentWeekType}`]}>
            {dashboard.currentWeekType}
          </dd>
        </div>
        <div className={styles.dataRow}>
          <dt>Sets structure</dt>
          <dd>
            {warmUpSets > 0 ? `${warmUpSets} warm-up + ` : ''}
            {workingSets} working
          </dd>
        </div>
      </dl>

      <h3 className={styles.sectionLabel}>Exercises</h3>
      <ul className={styles.exerciseList}>
        {exercises.map((name) => (
          <li key={name} className={styles.exerciseItem}>
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
}
