'use client';

import { useId, useState } from 'react';
import styles from '../onboarding.module.css';
import { isWeightOnly, type DiscoveryMethod, type LiftRow } from '../lib';

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
  const [focused, setFocused] = useState(false);
  const listboxId = useId();

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
  const canAddCustom = trimmed.length > 0 && !alreadySelected && !matchesCatalog && available.length === 0;

  function handleAdd(lift: string) {
    onAdd(lift);
    setQuery('');
  }

  const weightOnly = isWeightOnly(method);
  const hint =
    method === 'tm'
      ? 'Enter your current training max for each lift.'
      : method === 'manual'
        ? 'Enter your current 1-rep max for each lift.'
        : 'Enter a recent heavy set (weight × reps) for each lift.';

  return (
    <>
      <h2 className={styles.stepTitle}>Enter your lifts</h2>
      <p className={styles.stepHint}>{hint}</p>
      <div className={styles.dataRows}>
        {lifts.map((row, index) => (
          <div key={row.lift} className={styles.dataRow}>
            <span className={styles.dataRowLabel}>{row.lift}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="Weight"
              className={styles.numberInput}
              value={row.weight}
              onChange={(e) => onChange(index, 'weight', e.target.value)}
              aria-label={`${row.lift} weight`}
            />
            <span className={styles.unitLabel}>lb</span>
            {!weightOnly && (
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
          role="combobox"
          aria-expanded={focused && (available.length > 0 || canAddCustom || query.length > 0)}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          type="search"
          placeholder="Add a lift…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={styles.liftSearchInput}
          aria-label="Add a lift"
        />
        {focused && (available.length > 0 || canAddCustom || query.length > 0) && (
          <>
            <ul id={listboxId} role="listbox" aria-label="Available lifts" className={styles.liftPickerList}>
              {available.map((lift) => (
                <li
                  key={lift}
                  role="option"
                  aria-selected={false}
                  className={styles.liftPickerItem}
                  onMouseDown={(e) => { e.preventDefault(); handleAdd(lift); }}
                >
                  {lift}
                </li>
              ))}
              {canAddCustom && (
                <li
                  role="option"
                  aria-selected={false}
                  className={styles.liftPickerItem}
                  onMouseDown={(e) => { e.preventDefault(); handleAdd(trimmed); }}
                >
                  Add &ldquo;{trimmed}&rdquo; as a custom lift
                </li>
              )}
            </ul>
            {available.length === 0 && !canAddCustom && (
              <p className={styles.liftPickerEmpty}>No lifts match &ldquo;{query}&rdquo;</p>
            )}
          </>
        )}
      </div>

      {!weightOnly && (
        <p className={styles.infoBox}>
          We use the Brzycki formula:{' '}
          <strong>1RM = weight × 36 ÷ (37 − reps)</strong>. Stay under 10 reps for accuracy.
        </p>
      )}
    </>
  );
}
