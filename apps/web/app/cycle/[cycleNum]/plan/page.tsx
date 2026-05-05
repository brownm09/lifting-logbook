import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { fetchCycleDashboard, fetchProgramSpec } from '@/lib/api';
import { deriveProgramPhases, deriveProgramSummary } from '@/lib/programPlan';
import styles from './plan.module.css';

const STATUS_ICON: Record<string, string> = {
  completed: '✓',
  'in-progress': '◆',
  upcoming: '→',
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ProgramPlanPage({
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
    redirect(`/cycle/${dashboard.cycleNum}/plan`);
  }

  const { durationWeeks } = deriveProgramSummary(specs);
  const today = new Date().toISOString().slice(0, 10);
  const phases = deriveProgramPhases(dashboard.weeks, today);
  const estCompletion = addDays(dashboard.cycleStartDate, durationWeeks * 7);

  return (
    <section className={styles.container}>
      <div className={styles.backRow}>
        <Link href={`/cycle/${dashboard.cycleNum}`}>← Back to Cycle</Link>
      </div>

      <h2 className={styles.heading}>Program Plan</h2>

      <dl className={styles.dataList}>
        <div className={styles.dataRow}>
          <dt>Start date</dt>
          <dd>{dashboard.cycleStartDate}</dd>
        </div>
        <div className={styles.dataRow}>
          <dt>Est. completion</dt>
          <dd>{estCompletion}</dd>
        </div>
        <div className={styles.dataRow}>
          <dt>Total weeks</dt>
          <dd>{durationWeeks}</dd>
        </div>
      </dl>

      <h3 className={styles.sectionLabel}>Phases</h3>
      <ul className={styles.phaseList}>
        {phases.map((phase) => (
          <li
            key={`${phase.name}-${phase.startWeek}`}
            className={`${styles.phaseCard} ${styles[`phase_${phase.type}`]} ${styles[`status_${phase.status}`]}`}
          >
            <div className={styles.phaseMain}>
              <span className={styles.phaseName}>{phase.name}</span>
              <span className={styles.phaseWeeks}>
                {phase.startWeek === phase.endWeek
                  ? `Week ${phase.startWeek}`
                  : `Weeks ${phase.startWeek}–${phase.endWeek}`}
              </span>
            </div>
            <div className={styles.phaseMeta}>
              <span className={`${styles.typeBadge} ${styles[`typeBadge_${phase.type}`]}`}>
                {phase.type}
              </span>
              <span
                className={styles.statusIcon}
                title={phase.status}
                aria-label={phase.status}
              >
                {STATUS_ICON[phase.status]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
