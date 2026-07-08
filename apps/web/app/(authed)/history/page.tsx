import { fetchLiftRecords, fetchTrainingMaxHistory } from '@/lib/api';
import { getActiveProgram } from '@/lib/active-program';
import { getPreferredUnit } from '@/lib/preferences';
import type {
  LiftRecordResponse,
  TrainingMaxHistoryEntryResponse,
  WeightUnit,
} from '@lifting-logbook/types';
import HistoryTabs from './HistoryTabs';
import styles from './history.module.css';

export type EnrichedRecord = LiftRecordResponse & {
  tmAtTime: number | null;
  tmUnit: WeightUnit | null;
  tmPercent: number | null;
  isPR: boolean;
};

function findTmAtTime(
  lift: string,
  date: string,
  entries: TrainingMaxHistoryEntryResponse[],
): TrainingMaxHistoryEntryResponse | null {
  return (
    entries
      .filter((e) => e.lift === lift && e.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  );
}

export default async function HistoryPage() {
  const program = await getActiveProgram();

  // Wrap the API calls so a transient failure (expired session token, API
  // unavailable) surfaces a non-blocking notice rather than crashing the server
  // component or silently rendering an empty page that reads as "no history yet".
  // The `.catch()` fallbacks keep the tabs rendering (graceful degradation);
  // `loadFailed` distinguishes a real fetch failure from a genuinely empty history.
  let loadFailed = false;
  const [records, { entries: tmEntries }, unit] = await Promise.all([
    fetchLiftRecords(program).catch((): LiftRecordResponse[] => {
      loadFailed = true;
      return [];
    }),
    fetchTrainingMaxHistory(program).catch(() => {
      loadFailed = true;
      return { entries: [] as TrainingMaxHistoryEntryResponse[] };
    }),
    getPreferredUnit(),
  ]);

  const sortedRecords = records.slice().sort((a, b) => b.date.localeCompare(a.date));

  const maxByLift = new Map<string, number>();
  for (const r of sortedRecords) {
    maxByLift.set(r.lift, Math.max(maxByLift.get(r.lift) ?? 0, r.weight));
  }

  // Walk oldest→newest; first record per lift that equals the max is the PR.
  const prRecordIds = new Set<string>();
  const prSeenLifts = new Set<string>();
  for (let i = sortedRecords.length - 1; i >= 0; i--) {
    const r = sortedRecords[i];
    if (!prSeenLifts.has(r.lift) && r.weight >= (maxByLift.get(r.lift) ?? 0)) {
      prRecordIds.add(r.id);
      prSeenLifts.add(r.lift);
    }
  }

  const enriched: EnrichedRecord[] = sortedRecords.map((r) => {
    const tm = findTmAtTime(r.lift, r.date, tmEntries);
    const tmPercent =
      tm !== null ? Math.round((r.weight / tm.weight) * 1000) / 10 : null;
    return {
      ...r,
      tmAtTime: tm?.weight ?? null,
      tmUnit: tm?.unit ?? null,
      tmPercent,
      isPR: prRecordIds.has(r.id),
    };
  });

  return (
    <main className={styles.pageContainer}>
      <h1 className={styles.pageHeading}>Lift History</h1>
      <p className={styles.pageIntro}>
        Your logged lifts and Training Max (TM) progression over time.
      </p>
      {loadFailed && (
        <p role="status" className={styles.loadError}>
          We couldn’t load your latest history just now. This is usually
          temporary — refresh the page in a moment to try again.
        </p>
      )}
      <HistoryTabs records={enriched} tmEntries={tmEntries} unit={unit} />
    </main>
  );
}
