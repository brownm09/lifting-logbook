'use client';

import { useState } from 'react';
import { WEIGHT_INCREMENT_OPTIONS, DEFAULT_WEIGHT_INCREMENT } from '@lifting-logbook/types';
import { saveWeightIncrement } from './actions';

export default function WeightIncrementForm({
  initialIncrement,
}: {
  initialIncrement: number | null;
}) {
  const [increment, setIncrement] = useState<number>(initialIncrement ?? DEFAULT_WEIGHT_INCREMENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSavedAt(null);
    setSaving(true);
    try {
      const result = await saveWeightIncrement(increment);
      setIncrement(result.defaultWeightIncrement ?? DEFAULT_WEIGHT_INCREMENT);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight rounding.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Weight Rounding</h2>
      <p>
        Computed workout weights are rounded to the nearest multiple of this value, so
        they match plates you actually have on hand. This doesn&apos;t affect training
        maxes you enter or import — those are always kept at full precision.
      </p>

      <label htmlFor="weight-increment-select">Rounding increment</label>
      <select
        id="weight-increment-select"
        value={increment}
        onChange={(e) => {
          setIncrement(Number(e.target.value));
          setSavedAt(null);
        }}
      >
        {WEIGHT_INCREMENT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt} lb
          </option>
        ))}
      </select>

      <div>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && <p role="alert">{error}</p>}
        {savedAt && <p>Saved at {savedAt}.</p>}
      </div>
    </section>
  );
}
