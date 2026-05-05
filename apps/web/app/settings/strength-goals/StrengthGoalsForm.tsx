'use client';

import { useState } from 'react';
import { evaluateStrengthTier } from '@lifting-logbook/core';
import type { BodyWeightResponse, StrengthGoalResponse, TrainingMaxResponse } from '@lifting-logbook/types';
import { saveStrengthGoal, removeStrengthGoal } from './actions';

interface Props {
  program: string;
  trainingMaxes: TrainingMaxResponse[];
  goals: StrengthGoalResponse[];
  bodyWeight: BodyWeightResponse | null;
}

interface GoalRowState {
  target: string;
  unit: 'lbs' | 'kg';
  ratio: string;
  saving: boolean;
  error: string | null;
}

export default function StrengthGoalsForm({ program, trainingMaxes, goals, bodyWeight }: Props) {
  const [bwValue, setBwValue] = useState(String(bodyWeight?.weight ?? ''));
  const [editingBw, setEditingBw] = useState(false);
  const [currentBw, setCurrentBw] = useState(bodyWeight?.weight ?? null);

  const initialRows = Object.fromEntries(
    trainingMaxes.map((m) => {
      const existing = goals.find((g) => g.lift === m.lift);
      return [
        m.lift,
        {
          target: String(existing?.target ?? ''),
          unit: (existing?.unit ?? 'lbs') as 'lbs' | 'kg',
          ratio: String(existing?.ratio ?? ''),
          saving: false,
          error: null,
        } satisfies GoalRowState,
      ];
    }),
  );

  const [rows, setRows] = useState<Record<string, GoalRowState>>(initialRows);
  const [savedGoals, setSavedGoals] = useState<Record<string, boolean>>(
    Object.fromEntries(goals.map((g) => [g.lift, true])),
  );

  function updateRow(lift: string, patch: Partial<GoalRowState>) {
    setRows((prev) => ({ ...prev, [lift]: { ...prev[lift], ...patch } }));
  }

  async function handleSave(lift: string) {
    const row = rows[lift];
    const target = parseFloat(row.target);
    if (isNaN(target) || target <= 0) {
      updateRow(lift, { error: 'Enter a positive number' });
      return;
    }
    const ratio = row.ratio ? parseFloat(row.ratio) : undefined;
    updateRow(lift, { saving: true, error: null });
    try {
      await saveStrengthGoal(program, lift, { target, unit: row.unit, ratio });
      setSavedGoals((prev) => ({ ...prev, [lift]: true }));
    } catch {
      updateRow(lift, { error: 'Save failed' });
    } finally {
      updateRow(lift, { saving: false });
    }
  }

  async function handleDelete(lift: string) {
    updateRow(lift, { saving: true, error: null });
    try {
      await removeStrengthGoal(program, lift);
      setSavedGoals((prev) => ({ ...prev, [lift]: false }));
      updateRow(lift, { target: '', ratio: '' });
    } catch {
      updateRow(lift, { error: 'Delete failed' });
    } finally {
      updateRow(lift, { saving: false });
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      <h1>Strength Goals</h1>

      {/* Body weight */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Body Weight</h2>
        {editingBw ? (
          <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              value={bwValue}
              onChange={(e) => setBwValue(e.target.value)}
              style={{ width: 80 }}
              aria-label="Body weight"
            />
            <span>lbs</span>
            <button
              type="button"
              onClick={() => {
                const w = parseFloat(bwValue);
                if (!isNaN(w) && w > 0) setCurrentBw(w);
                setEditingBw(false);
              }}
            >
              ✓
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setEditingBw(true)}>
            {currentBw !== null ? `${currentBw} lbs` : 'Set body weight'}
          </button>
        )}
      </section>

      {/* Per-lift goal cards */}
      <section>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Lift Goals</h2>
        {trainingMaxes.map((m) => {
          const row = rows[m.lift];
          const hasGoal = savedGoals[m.lift];
          const target = parseFloat(row.target);
          const progress =
            currentBw && hasGoal && !isNaN(target) && target > 0
              ? evaluateStrengthTier(m.weight, currentBw, target / currentBw).progressRatio
              : null;

          return (
            <div
              key={m.lift}
              style={{
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{m.lift}</strong>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  Current max: {m.weight} {m.unit}
                </span>
              </div>

              {progress !== null && (
                <div style={{ margin: '0.5rem 0' }}>
                  <div
                    style={{
                      height: 8,
                      background: '#eee',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(progress * 100, 100)}%`,
                        background: progress >= 1 ? '#22c55e' : '#3b82f6',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    {Math.round(progress * 100)}% of goal
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  placeholder="Target (lbs)"
                  value={row.target}
                  onChange={(e) => updateRow(m.lift, { target: e.target.value })}
                  style={{ width: 110 }}
                  aria-label={`Target for ${m.lift}`}
                />
                <select
                  value={row.unit}
                  onChange={(e) => updateRow(m.lift, { unit: e.target.value as 'lbs' | 'kg' })}
                  aria-label={`Unit for ${m.lift}`}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
                <input
                  type="number"
                  placeholder="BW ratio (e.g. 1.75)"
                  value={row.ratio}
                  onChange={(e) => updateRow(m.lift, { ratio: e.target.value })}
                  style={{ width: 130 }}
                  aria-label={`Body weight ratio for ${m.lift}`}
                />
                <button type="button" onClick={() => handleSave(m.lift)} disabled={row.saving}>
                  {row.saving ? '…' : '✓'}
                </button>
                {hasGoal && (
                  <button type="button" onClick={() => handleDelete(m.lift)} disabled={row.saving}>
                    ✕
                  </button>
                )}
              </div>
              {row.error && <p style={{ color: 'red', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{row.error}</p>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
