'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlannedSet } from '@/lib/workoutPlan';
import styles from './detail.module.css';

export interface LiftDetail {
  lift: string;
  tm: number;
  warmUpCount: number;
  workCount: number;
  plannedSets: PlannedSet[];
}

interface Props {
  liftDetails: LiftDetail[];
  cycleNum: number;
  workoutNum: number;
}

export default function CollapsibleLiftList({
  liftDetails,
  cycleNum,
  workoutNum,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(lift: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lift)) next.delete(lift);
      else next.add(lift);
      return next;
    });
  }

  return (
    <ul className={styles.liftList}>
      {liftDetails.map(({ lift, tm, warmUpCount, workCount, plannedSets }) => {
        const isExpanded = expanded.has(lift);
        const panelId = `lift-detail-${encodeURIComponent(lift)}`;
        const warmUpSets = plannedSets.filter((s) => s.type === 'warmup');
        const workSets = plannedSets.filter((s) => s.type === 'work');

        return (
          <li key={lift} className={styles.liftItem}>
            <div className={styles.liftItemRow}>
              <button
                type="button"
                className={styles.liftItemHeader}
                onClick={() => toggle(lift)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
              >
                <span
                  className={`${styles.liftToggleIcon} ${isExpanded ? styles.liftToggleIconExpanded : ''}`}
                  aria-hidden="true"
                >
                  ›
                </span>

                <span className={styles.liftName}>
                  {lift}
                  {tm > 0 && (
                    <span className={styles.liftTM}>TM: {tm} lbs</span>
                  )}
                </span>

                <span className={styles.liftSummary}>
                  {warmUpCount > 0 ? `${warmUpCount} warm-up • ` : ''}
                  {workCount} working
                </span>
              </button>

              <Link
                href={`/cycle/${cycleNum}/workout/${workoutNum}/detail/${encodeURIComponent(lift)}`}
                className={styles.liftHistoryBtn}
              >
                📊 History
              </Link>
            </div>

            <div
              id={panelId}
              className={`${styles.liftItemContent} ${isExpanded ? styles.liftItemContentVisible : ''}`}
            >
              <div className={styles.liftItemContentInner}>
                {warmUpSets.length > 0 && (
                  <div className={styles.setGroup}>
                    <span className={styles.setGroupLabel}>Warm-up</span>
                    {warmUpSets.map((s) => (
                      <div key={s.setLabel} className={styles.setRow}>
                        <span className={styles.setLabel}>{s.setLabel}</span>
                        <span className={styles.setSpec}>
                          {s.reps} × {s.weight} lbs
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {workSets.length > 0 && (
                  <div className={styles.setGroup}>
                    <span className={styles.setGroupLabel}>Working Sets</span>
                    {workSets.map((s) => (
                      <div key={s.setLabel} className={styles.setRow}>
                        <span className={styles.setLabel}>{s.setLabel}</span>
                        <span className={styles.setSpec}>
                          {s.reps} × {s.weight} lbs
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {plannedSets.length === 0 && (
                  <p className={styles.noSets}>
                    No sets — set a training max to see planned weights.
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
