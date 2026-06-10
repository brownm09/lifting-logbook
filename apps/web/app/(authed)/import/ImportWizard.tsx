'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  CustomProgramSummaryResponse,
  ImportCommitResponse,
  ImportError,
  ImportKind,
  ImportPreviewResponse,
} from '@lifting-logbook/types';
import { commitImport, previewImport } from '@/lib/client-api';
import styles from './import.module.css';

const STEP_LABELS = [
  'Source',
  'Analyzing',
  'Classify',
  'Map columns',
  'Review',
  'Preview',
  'Done',
];

const KIND_LABEL: Record<ImportKind, string> = {
  'lift-records': 'Lift History',
  'training-maxes': 'Training Maxes',
  'strength-goals': 'Strength Goals',
  'program-spec': 'Program',
};

const ALL_KINDS: ImportKind[] = [
  'lift-records',
  'training-maxes',
  'strength-goals',
  'program-spec',
];

function bucketClass(bucket: 'high' | 'medium' | 'low'): string {
  return bucket === 'high'
    ? styles.bucketHigh
    : bucket === 'medium'
      ? styles.bucketMedium
      : styles.bucketLow;
}

export function ImportWizard({ programs }: { programs: CustomProgramSummaryResponse[] }) {
  const [step, setStep] = useState(0);
  const [programId, setProgramId] = useState<string>(programs[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);
  const [commitErrors, setCommitErrors] = useState<ImportError[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = preview?.destination ?? null;
  const previewBody = preview?.preview ?? null;

  async function analyze(override?: ImportKind): Promise<ImportPreviewResponse | null> {
    if (!programId || !file) return null;
    setError(null);
    setBusy(true);
    try {
      const res = await previewImport(programId, file, override);
      setPreview(res);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleAnalyze() {
    setStep(1);
    const res = await analyze();
    setStep(res ? 2 : 0);
  }

  async function handlePickDestination(kind: ImportKind) {
    setStep(1);
    const res = await analyze(kind);
    setStep(res ? 3 : 2);
  }

  async function handleCommit() {
    if (!programId || !file || !destination) return;
    setCommitErrors(null);
    setBusy(true);
    try {
      const result = await commitImport(programId, file, destination);
      if (result.ok) {
        setCommitResult(result.data);
        setStep(6);
      } else {
        setCommitErrors(result.errors);
      }
    } catch (e) {
      // A network failure or non-JSON 500 rejects rather than returning the
      // {ok:false} union; surface it instead of leaving the step silent.
      setCommitErrors([
        { row: 0, message: e instanceof Error ? e.message : 'Import failed' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep(0);
    setFile(null);
    setPreview(null);
    setCommitResult(null);
    setCommitErrors(null);
    setError(null);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Import a file</h1>
          <p className={styles.headerSubtitle}>
            Step {step + 1} of {STEP_LABELS.length} · {STEP_LABELS[step]}
          </p>
          <nav className={styles.progressDots} aria-label="Import progress">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={[
                  styles.dot,
                  i === step ? styles.dotActive : '',
                  i < step ? styles.dotDone : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={i === step ? 'step' : undefined}
                aria-label={label}
              />
            ))}
          </nav>
        </header>

        <section className={styles.body}>
          {step === 0 && (
            <>
              <h2 className={styles.stepTitle}>Choose a file and program</h2>
              <p className={styles.stepHint}>
                Drop in any CSV — lift history, training maxes, strength goals, or a program.
                We&apos;ll figure out what it is.
              </p>
              {programs.length === 0 ? (
                <p className={styles.infoBox}>
                  You don&apos;t have a custom program yet.{' '}
                  <Link href="/programs">Create one</Link> to import into.
                </p>
              ) : (
                <div className={styles.field}>
                  <label htmlFor="import-program" className={styles.fieldLabel}>
                    Program
                  </label>
                  <select
                    id="import-program"
                    className={styles.select}
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.field}>
                <label htmlFor="import-file" className={styles.fieldLabel}>
                  CSV file
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".csv"
                  className={styles.fileInput}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {error && <p className={styles.errorNote}>{error}</p>}
            </>
          )}

          {step === 1 && (
            <div className={styles.analyzing}>
              <div className={styles.spinner} aria-hidden="true" />
              <p>Analyzing your file…</p>
            </div>
          )}

          {step === 2 && preview && (
            <>
              <h2 className={styles.stepTitle}>What we found</h2>
              {destination ? (
                <div className={styles.classifyCard}>
                  <div>
                    <span className={styles.destinationName}>
                      {KIND_LABEL[destination]}
                    </span>{' '}
                    <span className={`${styles.confidenceBadge} ${bucketClass(preview.classification.bucket)}`}>
                      {preview.classification.bucket} ·{' '}
                      {Math.round(preview.classification.confidence * 100)}%
                    </span>
                  </div>
                  {preview.classification.reasons.length > 0 && (
                    <div>
                      <p className={styles.stepHint}>Why this classification</p>
                      <ul className={styles.reasonList}>
                        {preview.classification.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preview.classification.alternatives.length > 0 && (
                    <div>
                      <p className={styles.stepHint}>Other possibilities considered</p>
                      <ul className={styles.altList}>
                        {preview.classification.alternatives.map((a) => (
                          <li key={a.type}>
                            {KIND_LABEL[a.type]} — {Math.round(a.confidence * 100)}%
                            {a.closeCall ? ' (close call)' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className={styles.stepHint}>
                    We couldn&apos;t confidently tell what this file is. Pick a destination,
                    or skip it.
                  </p>
                  <div className={styles.candidateList}>
                    {ALL_KINDS.map((kind) => {
                      const alt = preview.classification.alternatives.find((a) => a.type === kind);
                      const conf = alt ? Math.round(alt.confidence * 100) : null;
                      return (
                        <button
                          key={kind}
                          type="button"
                          className={styles.candidate}
                          onClick={() => handlePickDestination(kind)}
                        >
                          <span>{KIND_LABEL[kind]}</span>
                          {conf !== null && <span className={styles.stepHint}>{conf}%</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className={styles.stepTitle}>Map columns</h2>
              <p className={styles.infoBox}>
                Columns were mapped automatically. Manual column mapping is coming soon.
              </p>
            </>
          )}

          {step === 4 && preview && (
            <>
              <h2 className={styles.stepTitle}>Review</h2>
              {preview.errors.length > 0 ? (
                <div className={styles.errorBox}>
                  <strong>This file has {preview.errors.length} problem(s):</strong>
                  <ul className={styles.errorList}>
                    {preview.errors.slice(0, 20).map((e, i) => (
                      <li key={`${e.row}-${e.field}-${i}`}>
                        Row {e.row}
                        {e.field ? ` · ${e.field}` : ''}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className={styles.infoBox}>
                  {destination && `Destination: ${KIND_LABEL[destination]}. `}
                  No problems found — continue to preview the changes.
                </p>
              )}
            </>
          )}

          {step === 5 && previewBody && (
            <>
              <h2 className={styles.stepTitle}>Preview changes</h2>
              <div className={styles.countRow}>
                <div className={styles.countPill}>
                  <span className={styles.countValue}>{previewBody.creates}</span>
                  <span className={styles.countLabel}>Create</span>
                </div>
                <div className={styles.countPill}>
                  <span className={styles.countValue}>{previewBody.updates}</span>
                  <span className={styles.countLabel}>Update</span>
                </div>
                <div className={styles.countPill}>
                  <span className={styles.countValue}>{previewBody.skips}</span>
                  <span className={styles.countLabel}>Skip</span>
                </div>
              </div>
              <ul className={styles.deltaList}>
                {previewBody.deltas.slice(0, 200).map((d) => (
                  <li
                    key={d.key}
                    className={`${styles.deltaRow} ${
                      d.kind === 'create'
                        ? styles.deltaKindCreate
                        : d.kind === 'update'
                          ? styles.deltaKindUpdate
                          : styles.deltaKindSkip
                    }`}
                  >
                    <span className={styles.deltaLabel}>{d.label}</span>
                    <span className={styles.deltaChange}>
                      {d.kind === 'update'
                        ? `${d.before} → ${d.after}`
                        : d.kind === 'create'
                          ? d.after
                          : 'unchanged'}
                    </span>
                  </li>
                ))}
              </ul>
              {commitErrors && (
                <div className={styles.errorBox}>
                  <strong>Commit failed:</strong>
                  <ul className={styles.errorList}>
                    {commitErrors.slice(0, 20).map((e, i) => (
                      <li key={`${e.row}-${i}`}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {step === 6 && commitResult && (
            <div className={styles.successBanner}>
              <p className={styles.successTitle}>Import complete</p>
              <p className={styles.successBody}>
                {KIND_LABEL[commitResult.destination]}: {commitResult.created} created,{' '}
                {commitResult.updated} updated, {commitResult.skipped} skipped.
              </p>
            </div>
          )}
        </section>

        <div className={styles.actionRow}>
          {step >= 2 && step <= 5 && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setStep(step === 2 ? 0 : step - 1)}
              disabled={busy}
            >
              Back
            </button>
          )}

          {step === 0 && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleAnalyze}
              disabled={!programId || !file || busy}
            >
              Analyze
            </button>
          )}

          {step === 2 && destination && (
            <button type="button" className={styles.btnPrimary} onClick={() => setStep(3)}>
              Next
            </button>
          )}

          {step === 3 && (
            <button type="button" className={styles.btnPrimary} onClick={() => setStep(4)}>
              Next
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setStep(5)}
              disabled={!previewBody}
            >
              Next
            </button>
          )}

          {step === 5 && (
            <button
              type="button"
              className={styles.btnSuccess}
              onClick={handleCommit}
              disabled={busy || !previewBody}
            >
              {busy ? 'Importing…' : 'Commit import'}
            </button>
          )}

          {step === 6 && (
            <button type="button" className={styles.btnPrimary} onClick={reset}>
              Import another file
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
