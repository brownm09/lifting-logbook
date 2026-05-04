'use client';

import styles from '../onboarding.module.css';
import { LIFT_LABELS, type LiftKey } from '../lib';

type Max = { lift: LiftKey; oneRm: number };

type Props = {
  maxes: Max[];
};

export function StepConfirm({ maxes }: Props) {
  return (
    <>
      <h2 className={styles.stepTitle}>Confirm your training maxes</h2>
      <p className={styles.stepHint}>
        Estimated 1-rep maxes based on what you entered. Training maxes use 90% of the 1RM.
      </p>
      <div className={styles.maxesGrid}>
        {maxes.map(({ lift, oneRm }) => (
          <div key={lift} className={styles.maxRow}>
            <span className={styles.maxRowLabel}>{LIFT_LABELS[lift]}</span>
            <span className={styles.maxRowValue}>
              {oneRm > 0 ? `${oneRm} lb` : '—'}
              {oneRm > 0 && (
                <span
                  className={styles.unitLabel}
                  style={{ marginLeft: 'var(--space-2)' }}
                >
                  (TM {Math.round(oneRm * 0.9)} lb)
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
