'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { patchLiftMetadata } from '@/lib/client-api';
import type { LiftMetadataResponse } from '@lifting-logbook/types';
import styles from './LiftEditor.module.css';

interface Props {
  cycleNum: number;
  workoutNum: number;
  initialMetadata: LiftMetadataResponse;
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function LiftEditor({ cycleNum, workoutNum, initialMetadata }: Props) {
  const router = useRouter();
  // State is string[] matching the API contract; inputs display as comma-joined for editing.
  const [muscleGroups, setMuscleGroups] = useState<string[]>(initialMetadata.muscleGroups);
  const [substitutions, setSubstitutions] = useState<string[]>(initialMetadata.substitutions);
  const [foundational, setFoundational] = useState(initialMetadata.foundational);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await patchLiftMetadata(initialMetadata.lift, {
        muscleGroups,
        substitutions,
        foundational,
      });
      router.refresh();
      router.push(
        `/cycle/${cycleNum}/workout/${workoutNum}/detail/manage-lifts`,
      );
    } catch (err) {
      setError('Failed to save. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setMuscleGroups([]);
    setSubstitutions([]);
    setFoundational(false);
  }

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <span className={styles.label}>Lift</span>
        <p className={styles.readOnly}>{initialMetadata.lift}</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="muscleGroups">
          Muscle Groups
        </label>
        <input
          id="muscleGroups"
          type="text"
          className={styles.input}
          placeholder="e.g. Quads, Glutes, Hamstrings"
          value={muscleGroups.join(', ')}
          onChange={(e) => setMuscleGroups(parseList(e.target.value))}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="substitutions">
          Substitutions
        </label>
        <input
          id="substitutions"
          type="text"
          className={styles.input}
          placeholder="e.g. Leg Press, Hack Squat"
          value={substitutions.join(', ')}
          onChange={(e) => setSubstitutions(parseList(e.target.value))}
        />
      </div>

      <div className={styles.checkboxField}>
        <input
          id="foundational"
          type="checkbox"
          checked={foundational}
          onChange={(e) => setFoundational(e.target.checked)}
          disabled={saving}
        />
        <label className={styles.label} htmlFor="foundational">
          Foundational lift
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleReset}
          disabled={saving}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
