'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { upsertLiftOverride, deleteLiftOverride } from '@/lib/client-api';
import type { WorkoutLiftResponse } from '@lifting-logbook/types';
import styles from './ManageLiftsActions.module.css';

interface Props {
  program: string;
  cycleNum: number;
  workoutNum: number;
  lifts: WorkoutLiftResponse[];
}

export default function ManageLiftsActions({ program, cycleNum, workoutNum, lifts }: Props) {
  const router = useRouter();

  async function handleRemove(lift: string) {
    await upsertLiftOverride(program, cycleNum, workoutNum, { action: 'remove', lift });
    router.refresh();
  }

  const replaceUrl = (lift: string) =>
    `/cycle/${cycleNum}/workout/${workoutNum}/detail/manage-lifts/pick?action=replace&replacing=${encodeURIComponent(lift)}`;

  if (lifts.length === 0) {
    return <p className={styles.empty}>No lifts planned for this workout.</p>;
  }

  return (
    <ul className={styles.liftList}>
      {lifts.map(({ lift, planned }) => (
        <li key={lift} className={styles.liftItem}>
          <span className={styles.liftName}>
            {lift}
            {planned && <span className={styles.plannedBadge}>planned</span>}
          </span>
          <span className={styles.actions}>
            <Link href={replaceUrl(lift)} className={styles.btnSecondary}>
              Replace
            </Link>
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => void handleRemove(lift)}
            >
              Remove
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
