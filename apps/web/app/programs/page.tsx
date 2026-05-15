import { fetchCustomPrograms, fetchUserSettings } from '@/lib/api';
import ProgramsTabs from './ProgramsTabs';
import styles from './programs.module.css';

export default async function ProgramsPage() {
  const [settings, customPrograms] = await Promise.all([
    fetchUserSettings().catch(() => ({ activeProgram: null })),
    fetchCustomPrograms().catch(() => []),
  ]);

  return (
    <main className={styles.container}>
      <h1 className={styles.heading}>Programs</h1>
      <ProgramsTabs
        activeProgram={settings.activeProgram}
        customPrograms={customPrograms}
      />
    </main>
  );
}
