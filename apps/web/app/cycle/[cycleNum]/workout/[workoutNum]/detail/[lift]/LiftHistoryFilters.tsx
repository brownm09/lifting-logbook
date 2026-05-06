'use client';

import { useState } from 'react';
import type { LiftRecordResponse } from '@lifting-logbook/types';
import styles from './lift.module.css';

interface Props {
  records: LiftRecordResponse[];
}

export default function LiftHistoryFilters({ records }: Props) {
  const [minWeight, setMinWeight] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filtered = records.filter((r) => {
    if (minWeight !== '' && r.weight < Number(minWeight)) return false;
    if (dateFilter !== '' && !r.date.includes(dateFilter)) return false;
    return true;
  });

  return (
    <div>
      <div className={styles.filters}>
        <label className={styles.filterLabel}>
          Min weight
          <input
            type="number"
            min={0}
            value={minWeight}
            onChange={(e) => setMinWeight(e.target.value)}
            className={styles.filterInput}
            placeholder="e.g. 135"
          />
        </label>
        <label className={styles.filterLabel}>
          Date contains
          <input
            type="text"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={styles.filterInput}
            placeholder="e.g. 2026-04"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No sets match the current filters.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Workout</th>
              <th>Set</th>
              <th>Weight</th>
              <th>Reps</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.workoutNum}</td>
                <td>{r.setNum}</td>
                <td>{r.weight} lbs</td>
                <td>{r.reps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
