'use client';

import { useId, useState } from 'react';
import {
  parseCsvText,
  classifyImport,
  parseTrainingMaxes,
  type TrainingMax,
} from '@lifting-logbook/core';
import type { ImportClassification } from '@lifting-logbook/types';
import styles from '../onboarding.module.css';
import type { LiftRow } from '../lib';

// Mirrors the API import guards (apps/api/src/programs/import-file.util.ts:
// MAX_IMPORT_ROWS = 5_000; Fastify multipart caps the request body at 5 MB).
// Those constants are API-side only and the web app cannot import from apps/api,
// so the same limits are re-stated here for the client-side parse.
const MAX_IMPORT_ROWS = 5_000;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// Friendly labels for the "this isn't a training-maxes file" redirect, keyed by
// the other ImportKind values classifyImport can return.
const KIND_LABEL: Record<string, string> = {
  'lift-records': 'lift history',
  'strength-goals': 'strength goals',
  'program-spec': 'a program definition',
};

type Props = {
  /** Called with one row per lift (latest training max) once a file parses. */
  onImported: (rows: LiftRow[]) => void;
};

// Read a File as text via FileReader rather than `File.text()`: the latter is
// unimplemented in the jsdom version used by the component tests, whereas
// FileReader is supported in both jsdom and every target browser.
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Accept a file as training maxes when it classifies as such outright, or when
// training-maxes is a close-call runner-up (the user clearly uploaded TMs and
// another kind only edged it out). Anything else routes to the full /import tool.
function looksLikeTrainingMaxes(c: ImportClassification): boolean {
  if (c.type === 'training-maxes') return true;
  return c.alternatives.some((a) => a.type === 'training-maxes' && a.closeCall);
}

// A training-maxes export can carry history — several dated rows per lift. For
// onboarding we want each lift's *current* training max, so keep the row with
// the most recent dateUpdated per lift and drop non-positive weights.
function latestPerLift(maxes: TrainingMax[]): LiftRow[] {
  const byLift = new Map<string, { weight: number; dateUpdated: Date }>();
  for (const m of maxes) {
    const lift = String(m.lift).trim();
    if (!lift || !(m.weight > 0)) continue;
    const prev = byLift.get(lift);
    if (!prev || m.dateUpdated.getTime() > prev.dateUpdated.getTime()) {
      byLift.set(lift, { weight: m.weight, dateUpdated: m.dateUpdated });
    }
  }
  return Array.from(byLift.entries()).map(([lift, { weight }]) => ({
    lift,
    weight: String(Math.round(weight)),
    reps: '',
  }));
}

export function StepImport({ onImported }: Props) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSummary(null);
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    // Clear the input's value so re-selecting the *same* file (e.g. the user
    // fixed a malformed export on disk and picked it again) still fires
    // onChange. `file` is already captured above, so this is safe.
    input.value = '';

    // On any failure below we leave a prior successful import staged: the error
    // is shown but `onImported` is not re-called, so OnboardingFlow keeps the
    // last good rows and Next stays enabled. This is intentional — a fat-finger
    // re-upload after a good import should not discard the valid data.
    if (file.size > MAX_IMPORT_BYTES) {
      setError('That file is larger than 5 MB. Export a smaller training-maxes file and try again.');
      return;
    }

    let table;
    try {
      const text = await readFileText(file);
      table = parseCsvText(text);
    } catch {
      setError('We couldn’t read that file. Make sure it’s a CSV exported from a spreadsheet.');
      return;
    }

    if (table.length < 2) {
      setError('That file has no data rows. Expected a header row plus one row per lift.');
      return;
    }
    if (table.length - 1 > MAX_IMPORT_ROWS) {
      setError(`That file has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows. Trim it and try again.`);
      return;
    }

    const classification = classifyImport(table);
    if (!looksLikeTrainingMaxes(classification)) {
      const label =
        (classification.type && KIND_LABEL[classification.type]) ??
        'something other than training maxes';
      setError(
        `This looks like ${label}. Finish setup, then use the full Import tool to bring it in.`,
      );
      return;
    }

    let maxes: TrainingMax[];
    try {
      maxes = parseTrainingMaxes(table);
    } catch {
      // parseTrainingMaxes is all-or-nothing: a single malformed row (bad date,
      // non-numeric weight, empty lift) rejects the whole file. Granular per-row
      // repair lives in the full /import wizard; onboarding surfaces a clear
      // file-level error and lets the user fix the export.
      setError(
        'We found training-max columns but couldn’t read every row. Check that each row has a date, a lift name, and a numeric weight.',
      );
      return;
    }

    const rows = latestPerLift(maxes);
    if (rows.length === 0) {
      setError('No training maxes were found in that file.');
      return;
    }

    onImported(rows);
    setSummary(
      `Loaded ${rows.length} training max${rows.length === 1 ? '' : 'es'} from ${file.name}. Review them on the next step.`,
    );
  }

  return (
    <>
      <h2 className={styles.stepTitle}>Import your training maxes</h2>
      <p className={styles.stepHint}>
        Upload a training-maxes CSV (exported from a spreadsheet or another app) and we’ll fill
        these in for you — no reps needed, we’ll use the values as-is.
      </p>
      <div className={styles.dataRows}>
        <label htmlFor={inputId} className={styles.dataRowLabel}>
          Training-maxes CSV
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          aria-describedby={
            error ? `${inputId}-error` : summary ? `${inputId}-summary` : undefined
          }
        />
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className={`${styles.infoBox} ${styles.infoBoxError}`}
        >
          {error}
        </p>
      )}
      {summary && (
        <p id={`${inputId}-summary`} className={styles.infoBox}>
          {summary}
        </p>
      )}
    </>
  );
}
