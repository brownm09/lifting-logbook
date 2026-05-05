'use client';

import { useState } from 'react';
import { evaluateStrengthTier } from '@lifting-logbook/core';
import type { BodyWeightResponse, StrengthGoalResponse, TrainingMaxResponse } from '@lifting-logbook/types';
import { saveStrengthGoal, removeStrengthGoal, saveBodyWeight } from './actions';

interface Props {
  program: string;
  trainingMaxes: TrainingMaxResponse[];
  goals: StrengthGoalResponse[];
  bodyWeight: BodyWeightResponse | null;
}

interface GoalRowState {
  goalType: 'absolute' | 'relative';
  target: string;
  unit: 'lbs' | 'kg';
  ratio: string;
  saving: boolean;
  error: string | null;
}

function computeProgress(
  trainingMaxWeight: number,
  bw: number,
  goalType: 'absolute' | 'relative',
  target: string,
  ratio: string,
): number | null {
  if (goalType === 'relative') {
    const r = parseFloat(ratio);
    if (!isNaN(r) && r > 0 && bw > 0) {
      return evaluateStrengthTier(trainingMaxWeight, bw, r).progressRatio;
    }
  } else {
    const t = parseFloat(target);
    if (!isNaN(t) && t > 0) {
      return trainingMaxWeight / t;
    }
  }
  return null;
}

export default function StrengthGoalsForm({ program, trainingMaxes, goals, bodyWeight }: Props) {
  const [currentBw, setCurrentBw] = useState<number | null>(bodyWeight?.weight ?? null);
  const [bwInput, setBwInput] = useState(String(bodyWeight?.weight ?? ''));
  const [editingBw, setEditingBw] = useState(false);
  const [savingBw, setSavingBw] = useState(false);
  const [bwError, setBwError] = useState<string | null>(null);

  const initialRows = Object.fromEntries(
    trainingMaxes.map((m) => {
      const existing = goals.find((g) => g.lift === m.lift);
      return [
        m.lift,
        {
          goalType: (existing?.goalType ?? 'relative') as 'absolute' | 'relative',
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

  async function handleSaveBw() {
    const w = parseFloat(bwInput);
    if (isNaN(w) || w <= 0) {
      setBwError('Enter a positive number');
      return;
    }
    setSavingBw(true);
    setBwError(null);
    try {
      await saveBodyWeight(program, w, 'lbs');
      setCurrentBw(w);
      setEditingBw(false);
    } catch {
      setBwError('Save failed');
    } finally {
      setSavingBw(false);
    }
  }

  async function handleSave(lift: string) {
    const row = rows[lift];
    if (row.goalType === 'relative') {
      const ratio = parseFloat(row.ratio);
      if (isNaN(ratio) || ratio <= 0) {
        updateRow(lift, { error: 'Enter a positive ratio (e.g. 1.75)' });
        return;
      }
    } else {
      const target = parseFloat(row.target);
      if (isNaN(target) || target <= 0) {
        updateRow(lift, { error: 'Enter a positive target weight' });
        return;
      }
    }
    updateRow(lift, { saving: true, error: null });
    try {
      const body =
        row.goalType === 'relative'
          ? { goalType: 'relative' as const, ratio: parseFloat(row.ratio), unit: row.unit }
          : { goalType: 'absolute' as const, target: parseFloat(row.target), unit: row.unit };
      await saveStrengthGoal(program, lift, body);
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              value={bwInput}
              onChange={(e) => setBwInput(e.target.value)}
              style={{ width: 80 }}
              aria-label="Body weight"
              autoFocus
            />
            <span>lbs</span>
            <button type="button" onClick={handleSaveBw} disabled={savingBw}>
              {savingBw ? '…' : '✓'}
            </button>
            <button type="button" onClick={() => { setEditingBw(false); setBwError(null); }}>
              ✕
            </button>
            {bwError && <span style={{ color: 'red', fontSize: '0.8rem' }}>{bwError}</span>}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: '#f8f9fa',
              borderRadius: 6,
              border: '1px solid #ecf0f1',
              cursor: 'pointer',
              width: 'fit-content',
            }}
            onClick={() => { setEditingBw(true); setBwInput(String(currentBw ?? '')); }}
            role="button"
            aria-label="Record new body weight"
          >
            <span style={{ fontWeight: 600 }}>
              {currentBw !== null ? `${currentBw} lbs` : 'No weight recorded'}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>✎ Record new weight</span>
          </div>
        )}
      </section>

      {/* Per-lift goal cards */}
      <section>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Lift Goals</h2>
        {trainingMaxes.map((m) => {
          const row = rows[m.lift];
          const hasGoal = savedGoals[m.lift];
          const progress = currentBw
            ? computeProgress(m.weight, currentBw, row.goalType, row.target, row.ratio)
            : null;

          const computedTarget =
            row.goalType === 'relative' && currentBw && parseFloat(row.ratio) > 0
              ? Math.round(currentBw * parseFloat(row.ratio))
              : null;

          const bwPercent =
            row.goalType === 'absolute' && currentBw && parseFloat(row.target) > 0
              ? Math.round((parseFloat(row.target) / currentBw) * 100)
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <strong>{m.lift}</strong>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  Current max: {m.weight} {m.unit}
                </span>
              </div>

              {/* Goal type toggle */}
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                {(['relative', 'absolute'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateRow(m.lift, { goalType: type })}
                    style={{
                      padding: '2px 10px',
                      fontSize: '0.75rem',
                      borderRadius: 4,
                      border: '1px solid #ccc',
                      background: row.goalType === type ? '#3b82f6' : '#f5f5f5',
                      color: row.goalType === type ? '#fff' : '#333',
                      cursor: 'pointer',
                    }}
                  >
                    {type === 'relative' ? 'Relative (× BW)' : 'Absolute (lbs/kg)'}
                  </button>
                ))}
              </div>

              {/* Input fields */}
              {row.goalType === 'relative' ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    placeholder="BW ratio (e.g. 1.75)"
                    value={row.ratio}
                    onChange={(e) => updateRow(m.lift, { ratio: e.target.value })}
                    style={{ width: 140 }}
                    aria-label={`Body weight ratio for ${m.lift}`}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#555' }}>× BW</span>
                  {computedTarget !== null && (
                    <span
                      style={{ fontSize: '0.8rem', color: '#666' }}
                      title={`${row.ratio}× BW = ${computedTarget} lbs at current weight`}
                    >
                      = {computedTarget} lbs
                    </span>
                  )}
                  <select
                    value={row.unit}
                    onChange={(e) => updateRow(m.lift, { unit: e.target.value as 'lbs' | 'kg' })}
                    aria-label={`Unit for ${m.lift}`}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    placeholder="Target weight"
                    value={row.target}
                    onChange={(e) => updateRow(m.lift, { target: e.target.value })}
                    style={{ width: 110 }}
                    aria-label={`Target weight for ${m.lift}`}
                  />
                  <select
                    value={row.unit}
                    onChange={(e) => updateRow(m.lift, { unit: e.target.value as 'lbs' | 'kg' })}
                    aria-label={`Unit for ${m.lift}`}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                  {bwPercent !== null && (
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                      = {bwPercent}% of body weight
                    </span>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {progress !== null && hasGoal && (
                <div style={{ margin: '0.5rem 0' }}>
                  <div
                    title={
                      row.goalType === 'relative'
                        ? `Goal: ${row.ratio}× BW`
                        : `Goal: ${row.target} ${row.unit}`
                    }
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
                    {row.goalType === 'relative' && row.ratio
                      ? ` (${row.ratio}× BW)`
                      : ''}
                  </span>
                </div>
              )}

              {/* Save / delete */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => handleSave(m.lift)} disabled={row.saving}>
                  {row.saving ? '…' : '✓ Save'}
                </button>
                {hasGoal && (
                  <button type="button" onClick={() => handleDelete(m.lift)} disabled={row.saving}>
                    ✕ Remove
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
