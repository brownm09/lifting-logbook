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

export default function LiftEditor({ cycleNum, workoutNum, initialMetadata }: Props) {
  const router = useRouter();
  const [muscleGroups, setMuscleGroups] = useState(initialMetadata.muscleGroups.join(', '));
  const [substitutions, setSubstitutions] = useState(initialMetadata.substitutions.join(', '));
  const [foundational, setFoundational] = useState(initialMetadata.foundational);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseList(value: string): string[] {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await patchLiftMetadata(initialMetadata.lift, {
        muscleGroups: parseList(muscleGroups),
        substitutions: parseList(substitutions),
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
    setMuscleGroups('');
    setSubstitutions('');
    setFoundational('');
  }

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <span className={styles.label}>Lift</span>
        <p className={styles.readOnly}>{initialMetadata.lift}</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="muscleGroups">
          Muscle Groups (comma-separated)
        </label>
        <input
          id="muscleGroups"
          type="text"
          className={styles.input}
          value={muscleGroups}
          onChange={(e) => setMuscleGroups(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="substitutions">
          Substitutions (comma-separated)
        </label>
        <input
          id="substitutions"
          type="text"
          className={styles.input}
          value={substitutions}
          onChange={(e) => setSubstitutions(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="foundational">
          Foundational Lift
        </label>
        <input
          id="foundational"
          type="text"
          className={styles.input}
          value={foundational}
          onChange={(e) => setFoundational(e.target.value)}
        />
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
          Reset to Foundational
        </button>
      </div>
    </div>
  );
}
