'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  ColumnMapping,
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

type FieldOption = { key: string; label: string };

const KIND_FIELDS: Record<ImportKind, FieldOption[]> = {
  'lift-records': [
    { key: 'program', label: 'Program' },
    { key: 'cycleNum', label: 'Cycle #' },
    { key: 'workoutNum', label: 'Workout #' },
    { key: 'date', label: 'Date' },
    { key: 'lift', label: 'Lift' },
    { key: 'setNum', label: 'Set #' },
    { key: 'weight', label: 'Weight' },
    { key: 'reps', label: 'Reps' },
    { key: 'amrap', label: 'AMRAP' },
    { key: 'notes', label: 'Notes' },
  ],
  'training-maxes': [
    { key: 'lift', label: 'Lift' },
    { key: 'weight', label: 'Weight' },
    { key: 'dateUpdated', label: 'Date Updated' },
  ],
  'strength-goals': [],
  'program-spec': [
    { key: 'week', label: 'Week' },
    { key: 'offset', label: 'Offset' },
    { key: 'lift', label: 'Lift' },
    { key: 'increment', label: 'Increment' },
    { key: 'order', label: 'Order' },
    { key: 'sets', label: 'Sets' },
    { key: 'reps', label: 'Reps' },
    { key: 'amrap', label: 'AMRAP?' },
    { key: 'warmUpPct', label: 'Warm-Up %' },
    { key: 'wtDecrementPct', label: 'WT Decrement %' },
    { key: 'activation', label: 'Activation' },
    { key: 'weekType', label: 'Week Type' },
  ],
};

function getAllFieldsForKind(kind: ImportKind): FieldOption[] {
  return KIND_FIELDS[kind] ?? [];
}

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
  // Map from sourceHeader → override destinationField (user-chosen via dropdown)
  const [columnOverrides, setColumnOverrides] = useState<Map<string, string>>(new Map());

  const destination = preview?.destination ?? null;
  const previewBody = preview?.preview ?? null;

  // Unmapped required sentinel rows have sourceHeader:''; use destinationField as key
  // so multiple such rows can be assigned independently.
  function mappingKey(m: ColumnMapping): string {
    return m.sourceHeader || `__req__:${m.destinationField}`;
  }

  // Effective column mappings after applying user overrides
  const effectiveMappings: ColumnMapping[] = (preview?.columnMappings ?? []).map((m) =>
    columnOverrides.has(mappingKey(m))
      ? { ...m, destinationField: columnOverrides.get(mappingKey(m)) ?? m.destinationField, confidence: 1 }
      : m,
  );

  const allRequiredMapped = effectiveMappings
    .filter((m) => m.required)
    .every((m) => m.destinationField !== '' && m.confidence > 0);

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
    setColumnOverrides(new Map());
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
    setColumnOverrides(new Map());
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

          {step === Step.MAP_COLUMNS && preview && destination && (
            <>
              <h2 className={styles.stepTitle}>Map columns</h2>
              {effectiveMappings.length > 0 ? (
                <>
                  <p className={styles.stepHint}>
                    We matched your CSV columns to the expected fields. Required fields are
                    marked <span className={styles.requiredStar}>★</span>. Override any mapping
                    using the dropdowns below.
                  </p>
                  {!allRequiredMapped && (
                    <div className={styles.unmappedAlert}>
                      Some required fields are not yet mapped. Assign them before continuing.
                    </div>
                  )}
                  <table className={styles.mappingTable} aria-label="Column mappings">
                    <thead>
                      <tr>
                        <th>Your column</th>
                        <th>Maps to</th>
                        <th>Confidence</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveMappings.map((m, i) => {
                        const allFields = getAllFieldsForKind(destination);
                        const confPct = Math.round(m.confidence * 100);
                        const confClass =
                          m.confidence >= 0.7
                            ? styles.confHigh
                            : m.confidence >= 0.4
                              ? styles.confMedium
                              : styles.confLow;
                        const isUnmappedRequired = m.required && (m.destinationField === '' || m.confidence === 0);

                        return (
                          <tr
                            key={`${m.sourceHeader}-${i}`}
                            className={isUnmappedRequired ? styles.unmappedRequired : ''}
                          >
                            <td>
                              {m.sourceHeader ? (
                                <span className={styles.sourceHeaderCell}>{m.sourceHeader}</span>
                              ) : (
                                <span className={styles.unmappedSourceCell}>(no match in CSV)</span>
                              )}
                              {m.required && (
                                <span className={styles.requiredStar} aria-label="required">★</span>
                              )}
                            </td>
                            <td>
                              <select
                                className={styles.mappingSelect}
                                aria-label={`Map column ${m.sourceHeader || '(unmapped)'}`}
                                value={columnOverrides.get(mappingKey(m)) ?? m.destinationField}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const key = mappingKey(m);
                                  setColumnOverrides((prev) => {
                                    const next = new Map(prev);
                                    if (val === m.destinationField) {
                                      next.delete(key);
                                    } else {
                                      next.set(key, val);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <option value="">— unmapped —</option>
                                {allFields.map(({ key, label }) => (
                                  <option key={key} value={key}>{label}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <span className={`${styles.confidencePct} ${confClass}`}>
                                {m.sourceHeader ? `${confPct}%` : '—'}
                              </span>
                            </td>
                            <td>
                              {m.transformationNote && (
                                <span className={styles.transformNote}>{m.transformationNote}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className={styles.mappingLegend}>
                    <span className={styles.requiredStar}>★</span> = required field
                  </p>
                </>
              ) : (
                <p className={styles.infoBox}>No column information available for this file.</p>
              )}
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
              onClick={() => setStep((step === Step.CLASSIFY ? Step.SOURCE : step - 1) as typeof Step[keyof typeof Step])}
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
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!allRequiredMapped}
              onClick={() => setStep(Step.REVIEW)}
            >
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
