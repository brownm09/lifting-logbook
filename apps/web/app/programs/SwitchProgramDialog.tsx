'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { switchProgram } from './actions';
import styles from './programs.module.css';

type Props = {
  programId: string;
  programName: string;
  currentProgramId: string | null;
  onClose: () => void;
};

export default function SwitchProgramDialog({
  programId,
  programName,
  currentProgramId,
  onClose,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await switchProgram(programId);
        router.push(`/cycle/${result.cycleNum}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to switch program.');
      }
    });
  }

  const currentLabel = currentProgramId ? `your current program` : 'your dashboard';

  return (
    <div className={styles.dialogOverlay} role="dialog" aria-modal="true">
      <div className={styles.dialog}>
        <p className={styles.dialogTitle}>Switch to {programName}?</p>
        <p className={styles.dialogBody}>
          {programName} will become your active program. Your existing lift history and
          training maxes for {currentLabel} are preserved and remain accessible.
        </p>
        {error && <p className={styles.errorNote}>{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Switching…' : 'Confirm Switch'}
          </button>
        </div>
      </div>
    </div>
  );
}
