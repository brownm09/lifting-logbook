'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { WeekRow, WorkoutCell } from '@/lib/workoutPlan';
import styles from './CycleDashboardGrid.module.css';

function findCurrentWeek(weeks: WeekRow[]): number {
  for (const row of weeks) {
    if (row.workouts.some((w) => w.status === 'upcoming')) {
      return row.week;
    }
  }
  return weeks[weeks.length - 1]?.week ?? 1;
}

function StatusBadge({ status }: { status: WorkoutCell['status'] }) {
  const label =
    status === 'completed'
      ? 'Completed'
      : status === 'upcoming'
        ? 'Upcoming'
        : 'Missed';
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
      {label}
    </span>
  );
}

function WorkoutCard({ cell }: { cell: WorkoutCell }) {
  return (
    <div className={`${styles.workoutCard} ${styles[`card_${cell.status}`]}`}>
      <div className={styles.cardHeader}>
        <time dateTime={cell.date}>{cell.date}</time>
        <StatusBadge status={cell.status} />
      </div>
      <ul className={styles.liftList}>
        {cell.lifts.map((lift) => (
          <li key={lift.name} className={styles.liftItem}>
            <strong>{lift.name}</strong>
            <ol className={styles.setList}>
              {lift.sets.map((s) => (
                <li key={s.setLabel}>
                  {s.setLabel}: {s.weight} lbs × {s.reps}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CycleDashboardGrid({
  cycleNum,
  weeks,
}: {
  cycleNum: number;
  weeks: WeekRow[];
}) {
  const currentWeek = findCurrentWeek(weeks);

  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const row of weeks) {
      initial[row.week] = row.week === currentWeek;
    }
    return initial;
  });

  return (
    <section className={styles.container}>
      <h2 className={styles.heading}>Cycle {cycleNum}</h2>
      <nav className={styles.quickNav}>
        <Link href={`/cycle/${cycleNum}/program`}>📋 Cycle Program</Link>
        <Link href={`/cycle/${cycleNum}/plan`}>🗓 Program Plan</Link>
        <Link href="/settings/training-maxes">💪 Training Maxes</Link>
        <Link href="/settings/strength-goals">🎯 Strength Goals</Link>
      </nav>
      <div className={styles.grid}>
        {weeks.map((row) => {
          const isExpanded = expanded[row.week] ?? row.week === currentWeek;
          return (
            <div key={row.week} className={styles.weekSection}>
              <button
                type="button"
                className={styles.weekToggle}
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [row.week]: !prev[row.week],
                  }))
                }
                aria-expanded={isExpanded}
              >
                <span>Week {row.week}</span>
                <span
                  className={styles.toggleIcon}
                  aria-hidden="true"
                >
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>
              {isExpanded && (
                <div className={styles.workouts}>
                  {row.workouts.map((cell) => (
                    <WorkoutCard key={cell.workoutNum} cell={cell} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
