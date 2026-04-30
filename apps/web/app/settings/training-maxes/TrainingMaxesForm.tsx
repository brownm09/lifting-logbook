'use client';

import { useState } from 'react';
import type { TrainingMaxResponse } from '@lifting-logbook/types';
import { updateTrainingMaxes } from '@/lib/api';
import styles from './TrainingMaxesForm.module.css';

type RowState = {
  value: string;
  unit: string;
  dateUpdated: string | null;
  error: string | null;
};

function buildInitialState(
  lifts: string[],
  maxes: TrainingMaxResponse[],
): Record<string, RowState> {
  const maxMap = new Map(maxes.map((m) => [m.lift, m]));
  const state: Record<string, RowState> = {};
  for (const lift of lifts) {
    const m = maxMap.get(lift);
    state[lift] = {
      value: m ? String(m.weight) : '',
      unit: m?.unit ?? 'lbs',
      dateUpdated: m?.dateUpdated ?? null,
      error: null,
    };
  }
  return state;
}

export default function TrainingMaxesForm({
  program,
  lifts,
  maxes,
}: {
  program: string;
  lifts: string[];
  maxes: TrainingMaxResponse[];
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    buildInitialState(lifts, maxes),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleChange(lift: string, value: string) {
    setRows((prev) => ({
      ...prev,
      [lift]: { ...prev[lift], value, error: null },
    }));
  }

  function validate(): boolean {
    let valid = true;
    setRows((prev) => {
      const next = { ...prev };
      for (const lift of lifts) {
        const { value } = prev[lift];
        if (value === '') continue; // skip empty rows
        const n = Number(value);
        if (isNaN(n) || n <= 0) {
          next[lift] = { ...prev[lift], error: 'Enter a positive number' };
          valid = false;
        }
      }
      return next;
    });
    return valid;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaveError(null);
    setSaving(true);

    const changed = lifts
      .filter((lift) => rows[lift].value !== '')
      .map((lift) => ({
        lift: lift as TrainingMaxResponse['lift'],
        weight: Number(rows[lift].value),
        unit: rows[lift].unit as TrainingMaxResponse['unit'],
      }));

    if (changed.length === 0) {
      setSaving(false);
      return;
    }

    try {
      const updated = await updateTrainingMaxes(program, { maxes: changed });
      const updatedMap = new Map(updated.map((m) => [m.lift, m]));
      setRows((prev) => {
        const next = { ...prev };
        for (const lift of lifts) {
          const m = updatedMap.get(lift);
          if (m) {
            next[lift] = {
              value: String(m.weight),
              unit: m.unit,
              dateUpdated: m.dateUpdated,
              error: null,
            };
          }
        }
        return next;
      });
    } catch {
      setSaveError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.container}>
      <h2 className={styles.heading}>Training Maxes</h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Lift</th>
              <th>Weight</th>
              <th>Unit</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {lifts.map((lift) => {
              const row = rows[lift];
              return (
                <tr key={lift} className={row.error ? styles.rowError : undefined}>
                  <td className={styles.liftName} data-label="Lift">{lift}</td>
                  <td className={styles.weightCell} data-label="Weight">
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={row.value}
                      placeholder="—"
                      aria-label={`${lift} training max`}
                      className={styles.weightInput}
                      onChange={(e) => handleChange(lift, e.target.value)}
                    />
                    {row.error && (
                      <span className={styles.errorText}>{row.error}</span>
                    )}
                  </td>
                  <td className={styles.unit} data-label="Unit">{row.unit}</td>
                  <td className={styles.date} data-label="Last Updated">
                    {row.dateUpdated ?? <span className={styles.placeholder}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {saveError && <p className={styles.saveError}>{saveError}</p>}
      <button
        className={styles.saveButton}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </section>
  );
}
