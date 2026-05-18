'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { skipWorkout, unskipWorkout } from '@/lib/client-api';
import styles from './SkipForm.module.css';

interface Props {
  program: string;
  cycleNum: number;
  workoutNum: number;
  skipped: boolean;
}

export default function SkipForm({ program, cycleNum, workoutNum, skipped }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      if (skipped) {
        await unskipWorkout(program, cycleNum, workoutNum);
      } else {
        await skipWorkout(program, cycleNum, workoutNum, reason || undefined);
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(skipped ? 'Failed to undo skip. Please try again.' : 'Failed to skip workout. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        {skipped ? '↩ Undo Skip' : '⊘ Mark as Skipped'}
      </button>
    );
  }

  return (
    <div className={styles.form}>
      {skipped ? (
        <p className={styles.infoBox}>
          Undo the skip for this workout. It will return to its previous status.
        </p>
      ) : (
        <>
          <p className={styles.infoBox}>
            Mark this workout as skipped. It will count as done for the week.
          </p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="skip-reason">
              Reason <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="skip-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={styles.input}
              placeholder="e.g. Travel, illness, rest day"
              aria-describedby={error ? 'skip-error' : undefined}
            />
          </div>
        </>
      )}
      {error && (
        <p id="skip-error" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => {
            setOpen(false);
            setReason('');
            setError(null);
          }}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          className={skipped ? styles.undo : styles.skip}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading
            ? skipped ? 'Undoing…' : 'Skipping…'
            : skipped ? 'Undo Skip' : 'Skip Workout'}
        </button>
      </div>
    </div>
  );
}
