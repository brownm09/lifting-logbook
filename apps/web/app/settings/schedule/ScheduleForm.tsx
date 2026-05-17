'use client';

import { useState } from 'react';
import type { UserWorkoutSchedule } from '@lifting-logbook/types';
import { saveSchedule } from './actions';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type Mode = 'none' | 'fixed' | 'rotating';

function initialState(schedule: UserWorkoutSchedule | null): {
  mode: Mode;
  fixedDays: number[];
  rotatingWeeks: number[][];
} {
  if (!schedule) return { mode: 'none', fixedDays: [], rotatingWeeks: [[]] };
  if (schedule.type === 'fixed') {
    return {
      mode: 'fixed',
      fixedDays: schedule.days ?? [],
      rotatingWeeks: [[]],
    };
  }
  return {
    mode: 'rotating',
    fixedDays: [],
    rotatingWeeks: schedule.weeks?.length ? schedule.weeks : [[]],
  };
}

function toggleDay(days: number[], day: number): number[] {
  return days.includes(day)
    ? days.filter((d) => d !== day).sort((a, b) => a - b)
    : [...days, day].sort((a, b) => a - b);
}

export default function ScheduleForm({
  initialSchedule,
}: {
  initialSchedule: UserWorkoutSchedule | null;
}) {
  const init = initialState(initialSchedule);
  const [mode, setMode] = useState<Mode>(init.mode);
  const [fixedDays, setFixedDays] = useState<number[]>(init.fixedDays);
  const [rotatingWeeks, setRotatingWeeks] = useState<number[][]>(init.rotatingWeeks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function buildPayload(): UserWorkoutSchedule | null {
    if (mode === 'none') return null;
    if (mode === 'fixed') return { type: 'fixed', days: fixedDays };
    return { type: 'rotating', weeks: rotatingWeeks };
  }

  function validate(payload: UserWorkoutSchedule | null): string | null {
    if (payload === null) return null;
    if (payload.type === 'fixed') {
      if (!payload.days || payload.days.length === 0) {
        return 'Pick at least one day.';
      }
    } else {
      if (!payload.weeks || payload.weeks.some((w) => w.length === 0)) {
        return 'Each week must have at least one day.';
      }
    }
    return null;
  }

  async function handleSave() {
    setError(null);
    setSavedAt(null);
    const payload = buildPayload();
    const validationError = validate(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await saveSchedule({ workoutSchedule: payload });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Workout Schedule</h2>
      <p>
        Choose which days of the week you usually train. Lifting Logbook uses this to
        distribute upcoming workouts across the calendar.
      </p>

      <fieldset>
        <legend>Mode</legend>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'none'}
            onChange={() => setMode('none')}
          />
          No schedule (date is set when you log)
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'fixed'}
            onChange={() => setMode('fixed')}
          />
          Fixed days
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'rotating'}
            onChange={() => setMode('rotating')}
          />
          Rotating weeks
        </label>
      </fieldset>

      {mode === 'fixed' && (
        <fieldset>
          <legend>Training days</legend>
          {DAY_LABELS.map((label, idx) => (
            <label key={idx}>
              <input
                type="checkbox"
                checked={fixedDays.includes(idx)}
                onChange={() => setFixedDays((d) => toggleDay(d, idx))}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      {mode === 'rotating' && (
        <div>
          {rotatingWeeks.map((week, weekIdx) => (
            <fieldset key={weekIdx}>
              <legend>Week {weekIdx + 1}</legend>
              {DAY_LABELS.map((label, dayIdx) => (
                <label key={dayIdx}>
                  <input
                    type="checkbox"
                    checked={week.includes(dayIdx)}
                    onChange={() =>
                      setRotatingWeeks((weeks) =>
                        weeks.map((w, i) => (i === weekIdx ? toggleDay(w, dayIdx) : w)),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
              {rotatingWeeks.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setRotatingWeeks((weeks) => weeks.filter((_, i) => i !== weekIdx))
                  }
                >
                  Remove week
                </button>
              )}
            </fieldset>
          ))}
          {rotatingWeeks.length < 8 && (
            <button type="button" onClick={() => setRotatingWeeks((w) => [...w, []])}>
              Add week
            </button>
          )}
        </div>
      )}

      <div>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save schedule'}
        </button>
        {error && <p role="alert">{error}</p>}
        {savedAt && <p>Saved at {savedAt}.</p>}
      </div>
    </section>
  );
}
