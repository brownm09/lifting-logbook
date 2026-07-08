'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatWeight } from '@lifting-logbook/core';
import type { WeightUnit } from '@lifting-logbook/types';
import { computeCycleProgress, type WeekRow, type WorkoutCell } from '@/lib/workoutPlan';
import styles from './CycleDashboardGrid.module.css';

function findCurrentWeek(weeks: WeekRow[]): number {
  for (const row of weeks) {
    if (row.workouts.some((w) => w.status === 'upcoming')) {
      return row.week;
    }
  }
  return weeks[weeks.length - 1]?.week ?? 1;
}

const STATUS_LABELS: Record<WorkoutCell['status'], string> = {
  completed: 'Completed',
  upcoming: 'Upcoming',
  missed: 'Missed',
  skipped: 'Skipped',
};

function StatusBadge({ status }: { status: WorkoutCell['status'] }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function WorkoutCard({
  cell,
  cycleNum,
  unit,
}: {
  cell: WorkoutCell;
  cycleNum: number;
  unit: WeightUnit;
}) {
  return (
    <Link
      href={`/cycle/${cycleNum}/workout/${cell.workoutNum}/detail`}
      className={`${styles.workoutCard} ${styles[`card_${cell.status}`]}`}
    >
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
                  {s.setLabel}: {formatWeight(s.weight, 'lbs', unit)} × {s.reps}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </Link>
  );
}

export default function CycleDashboardGrid({
  cycleNum,
  weeks,
  unit,
}: {
  cycleNum: number;
  weeks: WeekRow[];
  unit: WeightUnit;
}) {
  const currentWeek = findCurrentWeek(weeks);

  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const row of weeks) {
      initial[row.week] = row.week === currentWeek;
    }
    return initial;
  });

  const progress = computeCycleProgress(weeks);

  return (
    <section className={styles.container}>
      <p className={styles.eyebrow}>Dashboard</p>
      <h1 className={styles.heading}>Cycle {cycleNum}</h1>
      {progress.totalWorkouts > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Cycle Progress</span>
            <span className={styles.progressCount}>
              {progress.completedWorkouts} of {progress.totalWorkouts} workouts
            </span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Cycle progress"
            aria-valuenow={progress.completedWorkouts}
            aria-valuemin={0}
            aria-valuemax={progress.totalWorkouts}
          >
            <div
              className={`${styles.progressFill} ${
                progress.percent >= 100 ? styles.progressFill_complete : ''
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
      <nav className={styles.quickNav}>
        <Link href={`/cycle/${cycleNum}/program`}>📋 Cycle Program</Link>
        <Link href={`/cycle/${cycleNum}/plan`}>🗓 Program Plan</Link>
        <Link href="/settings/training-maxes">💪 Training Maxes</Link>
        <Link href="/settings/strength-goals">🎯 Strength Goals</Link>
        <Link href="/history">📚 Lift History</Link>
        <Link href="/programs">🗂 Programs</Link>
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
                    <WorkoutCard key={cell.workoutNum} cell={cell} cycleNum={cycleNum} unit={unit} />
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
