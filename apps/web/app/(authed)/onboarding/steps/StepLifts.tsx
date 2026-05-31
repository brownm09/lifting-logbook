'use client';

import styles from '../onboarding.module.css';
import { LIFT_LABELS, type DiscoveryMethod, type LiftEntry, type LiftKey } from '../lib';

type Props = {
  method: DiscoveryMethod;
  lifts: Record<LiftKey, LiftEntry>;
  onChange: (key: LiftKey, field: keyof LiftEntry, value: string) => void;
};

export function StepLifts({ method, lifts, onChange }: Props) {
  return (
    <>
      <h2 className={styles.stepTitle}>Enter your lifts</h2>
      <p className={styles.stepHint}>
        {method === 'manual'
          ? 'Enter your current 1-rep max for each lift.'
          : 'Enter a recent heavy set (weight × reps) for each lift.'}
      </p>
      <div className={styles.dataRows}>
        {(Object.keys(LIFT_LABELS) as LiftKey[]).map((key) => (
          <div key={key} className={styles.dataRow}>
            <span className={styles.dataRowLabel}>{LIFT_LABELS[key]}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="Weight"
              className={styles.numberInput}
              value={lifts[key].weight}
              onChange={(e) => onChange(key, 'weight', e.target.value)}
              aria-label={`${LIFT_LABELS[key]} weight`}
            />
            <span className={styles.unitLabel}>lb</span>
            {method !== 'manual' && (
              <>
                <span className={styles.unitLabel}>×</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="20"
                  placeholder="Reps"
                  className={styles.numberInput}
                  value={lifts[key].reps}
                  onChange={(e) => onChange(key, 'reps', e.target.value)}
                  aria-label={`${LIFT_LABELS[key]} reps`}
                />
                <span className={styles.unitLabel}>reps</span>
              </>
            )}
          </div>
        ))}
      </div>
      <p className={styles.infoBox}>
        We use the Brzycki formula:{' '}
        <strong>1RM = weight × 36 ÷ (37 − reps)</strong>. Stay under 10 reps for accuracy.
      </p>
    </>
  );
}
