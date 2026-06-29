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
import { Step, STEP_LABELS } from './steps';
import styles from './import.module.css';

type EditableMax = { lift: string; weight: string };

function buildTrainingMaxesCsv(rows: EditableMax[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = rows
    .filter((r) => Number(r.weight) > 0)
    .map((r) => `${today},"${r.lift.replace(/"/g, '""')}",${Math.round(Number(r.weight))}`);
  return ['Date Updated,Lift,Weight', ...lines].join('\n');
}


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
    ? styles.bucketHigh ?? ''
    : bucket === 'medium'
      ? styles.bucketMedium ?? ''
      : styles.bucketLow ?? '';
}

export function ImportWizard({ programs }: { programs: CustomProgramSummaryResponse[] }) {
  const [step, setStep] = useState<typeof Step[keyof typeof Step]>(Step.SOURCE);
  const [programId, setProgramId] = useState<string>(programs[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);
  const [commitErrors, setCommitErrors] = useState<ImportError[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // For training-maxes: user-editable rows populated from previewBody.deltas when
  // entering the Preview step. Null for all other destination kinds.
  const [editedMaxes, setEditedMaxes] = useState<EditableMax[] | null>(null);

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
    setStep(Step.ANALYZING);
    const res = await analyze();
    setStep(res ? Step.CLASSIFY : Step.SOURCE);
  }

  async function handlePickDestination(kind: ImportKind) {
    setStep(Step.ANALYZING);
    const res = await analyze(kind);
    setStep(res ? Step.MAP_COLUMNS : Step.CLASSIFY);
  }

  async function handleCommit() {
    if (!programId || !file || !destination) return;
    setCommitErrors(null);
    setBusy(true);

    // For training-maxes, rebuild a minimal CSV from the edited rows so the
    // commit reflects any weight corrections or row removals the user made.
    let commitFile = file;
    if (destination === 'training-maxes' && editedMaxes !== null) {
      const csv = buildTrainingMaxesCsv(editedMaxes);
      commitFile = new File([csv], file.name, { type: 'text/csv' });
    }

    try {
      const result = await commitImport(programId, commitFile, destination);
      if (result.ok) {
        setCommitResult(result.data);
        setStep(Step.DONE);
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
    setStep(Step.SOURCE);
    setFile(null);
    setPreview(null);
    setCommitResult(null);
    setCommitErrors(null);
    setError(null);
    setEditedMaxes(null);
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
          {step === Step.SOURCE && (
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

          {step === Step.ANALYZING && (
            <div className={styles.analyzing}>
              <div className={styles.spinner} aria-hidden="true" />
              <p>Analyzing your file…</p>
            </div>
          )}

          {step === Step.CLASSIFY && preview && (
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

          {step === Step.MAP_COLUMNS && (
            <>
              <h2 className={styles.stepTitle}>Map columns</h2>
              <p className={styles.infoBox}>
                Columns were mapped automatically. Manual column mapping is coming soon.
              </p>
            </>
          )}

          {step === Step.REVIEW && preview && (
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

          {step === Step.PREVIEW && previewBody && (
            <>
              <h2 className={styles.stepTitle}>Preview changes</h2>
              {destination === 'training-maxes' && editedMaxes !== null ? (
                <p className={styles.infoBox}>
                  {editedMaxes.length} max{editedMaxes.length !== 1 ? 'es' : ''} will be imported.
                </p>
              ) : (
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
              )}
              {destination === 'training-maxes' && editedMaxes !== null ? (
                <>
                  <p className={styles.stepHint}>
                    Edit weights or remove rows before committing.
                  </p>
                  <ul className={styles.maxEditList} aria-label="Training maxes to import">
                    {editedMaxes.map((row, i) => (
                      <li key={row.lift} className={styles.maxEditRow}>
                        <span className={styles.maxEditLift}>{row.lift}</span>
                        <input
                          type="number"
                          className={styles.maxEditWeight}
                          value={row.weight}
                          min={1}
                          aria-label={`Weight for ${row.lift}`}
                          onChange={(e) =>
                            setEditedMaxes((prev) =>
                              prev
                                ? prev.map((r, j) =>
                                    j === i ? { ...r, weight: e.target.value } : r,
                                  )
                                : prev,
                            )
                          }
                        />
                        <span className={styles.stepHint}>lbs</span>
                        <button
                          type="button"
                          className={styles.maxEditRemove}
                          onClick={() =>
                            setEditedMaxes((prev) =>
                              prev ? prev.filter((_, j) => j !== i) : prev,
                            )
                          }
                          aria-label={`Remove ${row.lift}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
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
              )}
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

          {step === Step.DONE && commitResult && (
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
              onClick={() => setStep(step === Step.CLASSIFY ? Step.SOURCE : step - 1)}
              disabled={busy}
            >
              Back
            </button>
          )}

          {step === Step.SOURCE && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleAnalyze}
              disabled={!programId || !file || busy}
            >
              Analyze
            </button>
          )}

          {step === Step.CLASSIFY && destination && (
            <button type="button" className={styles.btnPrimary} onClick={() => setStep(Step.MAP_COLUMNS)}>
              Next
            </button>
          )}

          {step === Step.MAP_COLUMNS && (
            <button type="button" className={styles.btnPrimary} onClick={() => setStep(Step.REVIEW)}>
              Next
            </button>
          )}

          {step === Step.REVIEW && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                // Only initialize when null — re-entering step 5 via Back preserves edits.
                if (destination === 'training-maxes' && previewBody && editedMaxes === null) {
                  setEditedMaxes(
                    previewBody.deltas
                      .filter((d) => d.kind === 'create' || d.kind === 'update')
                      .map((d) => ({ lift: d.label, weight: d.after ?? '' })),
                  );
                }
                setStep(Step.PREVIEW);
              }}
              disabled={!previewBody}
            >
              Next
            </button>
          )}

          {step === Step.PREVIEW && (
            <button
              type="button"
              className={styles.btnSuccess}
              onClick={handleCommit}
              disabled={
                busy ||
                !previewBody ||
                (destination === 'training-maxes' &&
                  editedMaxes !== null &&
                  (editedMaxes.length === 0 ||
                    editedMaxes.some((r) => !r.weight || Number(r.weight) <= 0)))
              }
            >
              {busy ? 'Importing…' : 'Commit import'}
            </button>
          )}

          {step === Step.DONE && (
            <button type="button" className={styles.btnPrimary} onClick={reset}>
              Import another file
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
