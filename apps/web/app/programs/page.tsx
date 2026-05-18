import { fetchCustomPrograms, fetchUserSettings } from '@/lib/api';
import type { UserWorkoutSchedule } from '@lifting-logbook/types';
import ProgramsTabs from './ProgramsTabs';
import styles from './programs.module.css';

export default async function ProgramsPage() {
  const [settings, customPrograms] = await Promise.all([
    fetchUserSettings().catch(() => ({ activeProgram: null, workoutSchedule: null as UserWorkoutSchedule | null })),
    fetchCustomPrograms().catch(() => []),
  ]);

  return (
    <main className={styles.container}>
      <h1 className={styles.heading}>Programs</h1>
      <ProgramsTabs
        activeProgram={settings.activeProgram}
        workoutSchedule={settings.workoutSchedule ?? null}
        customPrograms={customPrograms}
      />
    </main>
  );
}
