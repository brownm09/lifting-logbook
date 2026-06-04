'use client';

import { useState } from 'react';
import styles from '../onboarding.module.css';
import type { DiscoveryMethod, LiftRow } from '../lib';

type Props = {
  method: DiscoveryMethod;
  lifts: LiftRow[];
  catalog: string[];
  onChange: (index: number, field: keyof Omit<LiftRow, 'lift'>, value: string) => void;
  onAdd: (lift: string) => void;
  onRemove: (index: number) => void;
};

export function StepLifts({ method, lifts, catalog, onChange, onAdd, onRemove }: Props) {
  const [query, setQuery] = useState('');

  const selected = new Set(lifts.map((row) => row.lift));
  const available = catalog.filter(
    (lift) => !selected.has(lift) && lift.toLowerCase().includes(query.toLowerCase()),
  );

  // Free-text custom lift: when the typed name matches no catalog entry and is
  // not already added, offer it as a custom lift. The training-maxes PATCH
  // appends unknown lift names, so a custom name persists like any catalog lift.
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  const alreadySelected = lifts.some((row) => row.lift.toLowerCase() === normalized);
  const matchesCatalog = catalog.some((lift) => lift.toLowerCase() === normalized);
  const canAddCustom = trimmed.length > 0 && !alreadySelected && !matchesCatalog;

  function handleAdd(lift: string) {
    onAdd(lift);
    setQuery('');
  }

  return (
    <>
      <h2 className={styles.stepTitle}>Enter your lifts</h2>
      <p className={styles.stepHint}>
        {method === 'manual'
          ? 'Enter your current 1-rep max for each lift.'
          : 'Enter a recent heavy set (weight × reps) for each lift.'}
      </p>
      <div className={styles.dataRows}>
        {lifts.map((row, index) => (
          <div key={row.lift} className={styles.dataRow}>
            <span className={styles.dataRowLabel}>{row.lift}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="Weight"
              className={styles.numberInput}
              value={row.weight}
              onChange={(e) => onChange(index, 'weight', e.target.value)}
              aria-label={`${row.lift} weight`}
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
                  value={row.reps}
                  onChange={(e) => onChange(index, 'reps', e.target.value)}
                  aria-label={`${row.lift} reps`}
                />
                <span className={styles.unitLabel}>reps</span>
              </>
            )}
            <button
              type="button"
              className={styles.removeLiftBtn}
              onClick={() => onRemove(index)}
              aria-label={`Remove ${row.lift}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className={styles.liftPicker}>
        <input
          type="search"
          placeholder="Add a lift…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.liftSearchInput}
          aria-label="Add a lift"
        />
        {query.length > 0 && (
          <ul className={styles.liftPickerList}>
            {available.map((lift) => (
              <li key={lift}>
                <button
                  type="button"
                  className={styles.liftPickerItem}
                  onClick={() => handleAdd(lift)}
                >
                  {lift}
                </button>
              </li>
            ))}
            {canAddCustom && (
              <li>
                <button
                  type="button"
                  className={styles.liftPickerItem}
                  onClick={() => handleAdd(trimmed)}
                >
                  Add &ldquo;{trimmed}&rdquo; as a custom lift
                </button>
              </li>
            )}
            {available.length === 0 && !canAddCustom && (
              <li className={styles.liftPickerEmpty}>No lifts match &ldquo;{query}&rdquo;</li>
            )}
          </ul>
        )}
      </div>

      <p className={styles.infoBox}>
        We use the Brzycki formula:{' '}
        <strong>1RM = weight × 36 ÷ (37 − reps)</strong>. Stay under 10 reps for accuracy.
      </p>
    </>
  );
}
