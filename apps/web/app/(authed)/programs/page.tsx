import { fetchCustomPrograms, fetchUserSettings } from '@/lib/api';
import type { UserSettingsResponse } from '@lifting-logbook/types';
import ProgramsTabs from './ProgramsTabs';
import styles from './programs.module.css';

const DEFAULT_SETTINGS: UserSettingsResponse = {
  activeProgram: null,
  workoutSchedule: null,
  defaultWeightIncrement: null,
};

export default async function ProgramsPage() {
  const [settings, customPrograms] = await Promise.all([
    fetchUserSettings().catch(() => DEFAULT_SETTINGS),
    fetchCustomPrograms().catch(() => []),
  ]);

  return (
    <main className={styles.container}>
      <h1 className={styles.heading}>Programs</h1>
      <ProgramsTabs
        activeProgram={settings.activeProgram}
        workoutSchedule={settings.workoutSchedule ?? null}
        defaultWeightIncrement={settings.defaultWeightIncrement}
        customPrograms={customPrograms}
      />
    </main>
  );
}
