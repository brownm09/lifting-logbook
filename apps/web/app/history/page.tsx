import Link from 'next/link';
import { fetchLiftRecords, fetchTrainingMaxHistory } from '@/lib/api';
import type {
  LiftRecordResponse,
  TrainingMaxHistoryEntryResponse,
} from '@lifting-logbook/types';
import HistoryTabs from './HistoryTabs';
import styles from './history.module.css';

export type EnrichedRecord = LiftRecordResponse & {
  tmAtTime: number | null;
  tmUnit: string | null;
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
  const program = process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';

  const [records, { entries: tmEntries }] = await Promise.all([
    fetchLiftRecords(program),
    fetchTrainingMaxHistory(program),
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
      <Link href="/" className={styles.backLink}>← Home</Link>
      <h1 className={styles.pageHeading}>Lift History</h1>
      <HistoryTabs records={enriched} tmEntries={tmEntries} />
    </main>
  );
}
