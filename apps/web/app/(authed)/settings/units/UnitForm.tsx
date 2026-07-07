'use client';

import { useState } from 'react';
import { WEIGHT_UNIT_OPTIONS, DEFAULT_WEIGHT_UNIT } from '@lifting-logbook/types';
import type { WeightUnit } from '@lifting-logbook/types';
import { saveUnit } from './actions';

export default function UnitForm({
  initialUnit,
}: {
  initialUnit: WeightUnit | null;
}) {
  const [unit, setUnit] = useState<WeightUnit>(initialUnit ?? DEFAULT_WEIGHT_UNIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSavedAt(null);
    setSaving(true);
    try {
      const result = await saveUnit(unit);
      setUnit(result.unit ?? DEFAULT_WEIGHT_UNIT);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight unit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Units</h2>
      <p>
        Sets the unit weights are displayed in across the app — dashboard, plan, history,
        and training maxes. This only changes how weights are shown; everything is still
        stored and compared at full precision.
      </p>

      <label htmlFor="weight-unit-select">Weight unit</label>
      <select
        id="weight-unit-select"
        value={unit}
        onChange={(e) => {
          setUnit(e.target.value as WeightUnit);
          setSavedAt(null);
        }}
      >
        {WEIGHT_UNIT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
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
