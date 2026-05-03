'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LiftRecordResponse } from '@lifting-logbook/types';
import {
  createLiftRecord,
  recordBodyWeight,
  updateLiftRecord,
} from '@/lib/client-api';
import styles from './WorkoutLogger.module.css';
import type { LiftData, WorkingSetData, WorkoutLoggerProps } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWarmUpWeight(
  totalLoad: number,
  bodyWeight: number | null,
  isBodyweightComponent: boolean,
): string {
  if (!isBodyweightComponent || bodyWeight === null) {
    return `${totalLoad} lbs`;
  }
  if (totalLoad <= bodyWeight) {
    return 'BW';
  }
  return `+${totalLoad - bodyWeight} lbs`;
}

function formatWorkingWeight(
  totalLoad: number,
  bodyWeight: number | null,
  isBodyweightComponent: boolean,
): { display: string; value: number } {
  if (!isBodyweightComponent || bodyWeight === null) {
    return { display: `${totalLoad} lbs`, value: totalLoad };
  }
  const added = Math.max(0, totalLoad - bodyWeight);
  return { display: `+${added} lbs`, value: added };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BodyWeightGate({
  onSubmit,
}: {
  onSubmit: (weight: number) => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const weight = Number(input);
    if (!weight || weight <= 0) {
      setError('Enter a valid body weight.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(weight);
    } catch {
      setError('Failed to save body weight. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.gate}>
      <h2 className={styles.gateHeading}>Body Weight</h2>
      <p className={styles.gateHint}>
        This workout includes bodyweight exercises. Enter your weight to
        calculate added load.
      </p>
      <form className={styles.gateForm} onSubmit={handleSubmit}>
        <label className={styles.gateLabel} htmlFor="bw-input">
          Body weight (lbs)
        </label>
        <input
          id="bw-input"
          className={styles.gateInput}
          type="number"
          min="50"
          max="500"
          step="0.5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        {error && <p className={styles.gateError}>{error}</p>}
        <button
          className={styles.gateSubmit}
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

function WarmUpRow({
  label,
  totalLoad,
  reps,
  bodyWeight,
  isBodyweightComponent,
}: {
  label: string;
  totalLoad: number;
  reps: number;
  bodyWeight: number | null;
  isBodyweightComponent: boolean;
}) {
  const weightStr = formatWarmUpWeight(totalLoad, bodyWeight, isBodyweightComponent);
  return (
    <li className={styles.warmUpRow}>
      <span className={styles.warmUpLabel}>{label}</span>
      <span className={styles.warmUpWeight}>
        {weightStr} × {reps}
      </span>
    </li>
  );
}

function WorkingSetRow({
  lift,
  set,
  bodyWeight,
  isBodyweightComponent,
  isReadOnly,
  loggedRecord,
  isEditing,
  program,
  cycleNum,
  workoutNum,
  date,
  onLogged,
  onEditStart,
  onEditSave,
}: {
  lift: string;
  set: WorkingSetData;
  bodyWeight: number | null;
  isBodyweightComponent: boolean;
  isReadOnly: boolean;
  loggedRecord?: LiftRecordResponse;
  isEditing: boolean;
  program: string;
  cycleNum: number;
  workoutNum: number;
  date: string;
  onLogged: (record: LiftRecordResponse) => void;
  onEditStart: () => void;
  onEditSave: (record: LiftRecordResponse) => void;
}) {
  const { value: defaultWeight } = formatWorkingWeight(
    set.totalLoad,
    bodyWeight,
    isBodyweightComponent,
  );
  // Pre-fill from the logged record when entering edit mode; fall back to plan defaults for new logs.
  const [weightInput, setWeightInput] = useState(
    loggedRecord
      ? String(formatWorkingWeight(loggedRecord.weight, null, false).value)
      : String(defaultWeight),
  );
  const [repsInput, setRepsInput] = useState(String(loggedRecord?.reps ?? set.reps));
  const [notesInput, setNotesInput] = useState(loggedRecord?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogged = !!loggedRecord && !isEditing;

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    const weight = Number(weightInput);
    const reps = Number(repsInput);
    if (isNaN(weight) || weight < 0 || isNaN(reps) || reps <= 0) {
      setError('Enter valid weight and reps.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const record = await createLiftRecord(program, {
        program,
        cycleNum,
        workoutNum,
        date,
        lift,
        setNum: set.setNum,
        weight,
        reps,
        notes: notesInput || undefined,
      });
      onLogged(record);
    } catch {
      setError('Failed to log set. Try again.');
      setSubmitting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedRecord) return;
    const weight = Number(weightInput);
    const reps = Number(repsInput);
    if (isNaN(weight) || weight < 0 || isNaN(reps) || reps <= 0) {
      setError('Enter valid weight and reps.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const record = await updateLiftRecord(program, loggedRecord.id, {
        weight,
        reps,
        notes: notesInput || undefined,
      });
      onEditSave(record);
    } catch {
      setError('Failed to save changes. Try again.');
      setSubmitting(false);
    }
  }

  if (isReadOnly || isLogged) {
    const displayWeight = loggedRecord
      ? formatWorkingWeight(loggedRecord.weight, null, false).display
      : formatWorkingWeight(set.totalLoad, bodyWeight, isBodyweightComponent).display;
    return (
      <li className={`${styles.setRow} ${styles.setRowLogged}`}>
        <span className={styles.setNum}>Set {set.setNum}</span>
        <span className={styles.setCheck}>✓</span>
        <span className={styles.setSummary}>
          {loggedRecord
            ? `${loggedRecord.weight} lbs × ${loggedRecord.reps}`
            : `${displayWeight} × ${set.reps}`}
          {set.amrap ? ' (AMRAP)' : ''}
        </span>
        {loggedRecord?.notes && (
          <span className={styles.setNotes}>{loggedRecord.notes}</span>
        )}
        {!isReadOnly && (
          <button
            className={styles.editBtn}
            type="button"
            onClick={onEditStart}
            aria-label={`Edit set ${set.setNum}`}
          >
            Edit
          </button>
        )}
      </li>
    );
  }

  const isEdit = isEditing && !!loggedRecord;
  return (
    <li className={styles.setRow}>
      <form
        className={styles.setForm}
        onSubmit={isEdit ? handleSave : handleLog}
      >
        <span className={styles.setNum}>Set {set.setNum}</span>
        {set.amrap && <span className={styles.amrapBadge}>AMRAP</span>}
        <label className={styles.srOnly} htmlFor={`weight-${lift}-${set.setNum}`}>
          Weight (lbs)
        </label>
        <input
          id={`weight-${lift}-${set.setNum}`}
          className={styles.setInput}
          type="number"
          min="0"
          step="2.5"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          disabled={submitting}
          aria-label="Weight in lbs"
        />
        <span className={styles.inputSep}>lbs ×</span>
        <label className={styles.srOnly} htmlFor={`reps-${lift}-${set.setNum}`}>
          Reps
        </label>
        <input
          id={`reps-${lift}-${set.setNum}`}
          className={styles.setInput}
          type="number"
          min="0"
          step="1"
          value={repsInput}
          onChange={(e) => setRepsInput(e.target.value)}
          disabled={submitting}
          aria-label="Reps"
        />
        <label className={styles.srOnly} htmlFor={`notes-${lift}-${set.setNum}`}>
          Notes (optional)
        </label>
        <input
          id={`notes-${lift}-${set.setNum}`}
          className={styles.notesInput}
          type="text"
          placeholder="Notes (optional)"
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          disabled={submitting}
        />
        {error && <p className={styles.setError}>{error}</p>}
        <button
          className={styles.logBtn}
          type="submit"
          disabled={submitting}
        >
          {submitting ? '…' : isEdit ? 'Save' : 'Log'}
        </button>
        {isEdit && (
          <button
            className={styles.cancelBtn}
            type="button"
            onClick={() => onEditSave(loggedRecord!)}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </form>
    </li>
  );
}

function LiftView({
  lift,
  bodyWeight,
  isReadOnly,
  loggedSets,
  editingSet,
  program,
  cycleNum,
  workoutNum,
  date,
  onLogged,
  onEditStart,
  onEditSave,
}: {
  lift: LiftData;
  bodyWeight: number | null;
  isReadOnly: boolean;
  loggedSets: Map<string, LiftRecordResponse>;
  editingSet: string | null;
  program: string;
  cycleNum: number;
  workoutNum: number;
  date: string;
  onLogged: (key: string, record: LiftRecordResponse) => void;
  onEditStart: (key: string) => void;
  onEditSave: (key: string, record: LiftRecordResponse) => void;
}) {
  return (
    <div className={styles.liftView}>
      <h2 className={styles.liftName}>{lift.lift}</h2>

      {lift.warmUpSets.length > 0 && (
        <section className={styles.warmUpSection} aria-label="Warm-up sets">
          {lift.warmUpImplement && (
            <p className={styles.warmUpImplement}>
              Warm-up on: <strong>{lift.warmUpImplement}</strong>
            </p>
          )}
          <ul className={styles.warmUpList}>
            {lift.warmUpSets.map((s, i) => (
              <WarmUpRow
                key={i}
                label={`Warm-up ${i + 1}`}
                totalLoad={s.totalLoad}
                reps={s.reps}
                bodyWeight={bodyWeight}
                isBodyweightComponent={lift.isBodyweightComponent}
              />
            ))}
          </ul>
        </section>
      )}

      <section className={styles.workingSection} aria-label="Working sets">
        <ul className={styles.setList}>
          {lift.workingSets.map((ws) => {
            const key = `${lift.lift}-${ws.setNum}`;
            return (
              <WorkingSetRow
                key={key}
                lift={lift.lift}
                set={ws}
                bodyWeight={bodyWeight}
                isBodyweightComponent={lift.isBodyweightComponent}
                isReadOnly={isReadOnly}
                loggedRecord={loggedSets.get(key)}
                isEditing={editingSet === key}
                program={program}
                cycleNum={cycleNum}
                workoutNum={workoutNum}
                date={date}
                onLogged={(record) => onLogged(key, record)}
                onEditStart={() => onEditStart(key)}
                onEditSave={(record) => onEditSave(key, record)}
              />
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function OverviewRow({
  lift,
  bodyWeight,
  loggedSets,
  onGoTo,
}: {
  lift: LiftData;
  bodyWeight: number | null;
  loggedSets: Map<string, LiftRecordResponse>;
  onGoTo: () => void;
}) {
  const logged = lift.workingSets.filter((ws) =>
    loggedSets.has(`${lift.lift}-${ws.setNum}`),
  ).length;
  const total = lift.workingSets.length;
  const firstWarmUp = lift.warmUpSets[0];
  return (
    <li className={styles.overviewRow}>
      <div className={styles.overviewRowHeader}>
        <strong className={styles.overviewLiftName}>{lift.lift}</strong>
        <span className={styles.overviewProgress}>
          {logged}/{total} sets
        </span>
        <button className={styles.goToBtn} type="button" onClick={onGoTo}>
          {logged === total ? 'Review' : logged > 0 ? 'Resume' : 'Go to'}
        </button>
      </div>
      {firstWarmUp && (
        <p className={styles.overviewWarmUp}>
          Warm-up:{' '}
          {formatWarmUpWeight(
            firstWarmUp.totalLoad,
            bodyWeight,
            lift.isBodyweightComponent,
          )}{' '}
          × {firstWarmUp.reps}
          {lift.warmUpSets.length > 1 ? ` (+${lift.warmUpSets.length - 1} more)` : ''}
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WorkoutLogger({
  program,
  cycleNum,
  workoutNum,
  date,
  lifts,
  hasBodyweightComponent,
  isReadOnly,
  initialBodyWeight,
}: WorkoutLoggerProps) {
  const router = useRouter();

  // Initialize loggedSets from any pre-existing records passed via server props
  const [loggedSets, setLoggedSets] = useState<Map<string, LiftRecordResponse>>(
    () => {
      const m = new Map<string, LiftRecordResponse>();
      for (const lift of lifts) {
        for (const ws of lift.workingSets) {
          if (ws.existing) {
            m.set(`${lift.lift}-${ws.setNum}`, ws.existing);
          }
        }
      }
      return m;
    },
  );
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [currentLiftIdx, setCurrentLiftIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'per-lift' | 'overview'>('per-lift');
  // initialBodyWeight is non-null when the server found a same-day body weight entry.
  const [bodyWeight, setBodyWeight] = useState<number | null>(initialBodyWeight);
  const [bodyWeightDone, setBodyWeightDone] = useState(
    !hasBodyweightComponent || isReadOnly || initialBodyWeight !== null,
  );

  async function handleBodyWeightSubmit(weight: number) {
    await recordBodyWeight(program, {
      date,
      weight,
      unit: 'lbs',
    });
    setBodyWeight(weight);
    setBodyWeightDone(true);
  }

  function handleLogged(key: string, record: LiftRecordResponse) {
    setLoggedSets((prev) => new Map(prev).set(key, record));
    setEditingSet(null);
  }

  function handleEditStart(key: string) {
    setEditingSet(key);
  }

  function handleEditSave(key: string, record: LiftRecordResponse) {
    setLoggedSets((prev) => new Map(prev).set(key, record));
    setEditingSet(null);
  }

  // Total sets logged across all lifts
  const totalSets = lifts.reduce((n, l) => n + l.workingSets.length, 0);
  const allLogged = loggedSets.size === totalSets && totalSets > 0;

  // Body weight gate
  if (!bodyWeightDone) {
    return <BodyWeightGate onSubmit={handleBodyWeightSubmit} />;
  }

  const currentLift = lifts[currentLiftIdx];
  const nextLift = lifts[currentLiftIdx + 1];

  // Overview mode
  if (viewMode === 'overview') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.screenTitle}>Workout {workoutNum}</h1>
          <button
            className={styles.viewToggle}
            type="button"
            aria-label="Switch to per-exercise view"
            onClick={() => setViewMode('per-lift')}
          >
            ✕
          </button>
        </header>
        <ul className={styles.overviewList}>
          {lifts.map((lift, i) => (
            <OverviewRow
              key={lift.lift}
              lift={lift}
              bodyWeight={bodyWeight}
              loggedSets={loggedSets}
              onGoTo={() => {
                setCurrentLiftIdx(i);
                setViewMode('per-lift');
              }}
            />
          ))}
        </ul>
        {allLogged && (
          <button
            className={styles.finishBtn}
            type="button"
            onClick={() => router.push(`/cycle/${cycleNum}`)}
          >
            Finish workout
          </button>
        )}
      </div>
    );
  }

  // Per-lift view
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.screenTitle}>Workout {workoutNum}</h1>
        <button
          className={styles.viewToggle}
          type="button"
          aria-label="Switch to overview"
          onClick={() => setViewMode('overview')}
        >
          ⊞
        </button>
      </header>

      {/* Navigation dots */}
      <nav className={styles.navDots} aria-label="Exercise navigation">
        {lifts.map((lift, i) => {
          const liftLogged = lift.workingSets.every((ws) =>
            loggedSets.has(`${lift.lift}-${ws.setNum}`),
          );
          return (
            <button
              key={lift.lift}
              className={`${styles.dot} ${i === currentLiftIdx ? styles.dotActive : ''} ${liftLogged ? styles.dotDone : ''}`}
              type="button"
              aria-label={`Go to ${lift.lift}`}
              aria-current={i === currentLiftIdx ? 'true' : undefined}
              onClick={() => setCurrentLiftIdx(i)}
            />
          );
        })}
      </nav>

      {/* Current lift */}
      {currentLift && (
        <LiftView
          lift={currentLift}
          bodyWeight={bodyWeight}
          isReadOnly={isReadOnly}
          loggedSets={loggedSets}
          editingSet={editingSet}
          program={program}
          cycleNum={cycleNum}
          workoutNum={workoutNum}
          date={date}
          onLogged={handleLogged}
          onEditStart={handleEditStart}
          onEditSave={handleEditSave}
        />
      )}

      {/* Bottom strip */}
      <footer className={styles.bottomStrip}>
        {nextLift ? (
          <>
            <span className={styles.nextLabel}>Next:</span>
            <span className={styles.nextName}>{nextLift.lift}</span>
            {nextLift.warmUpSets[0] && (
              <span className={styles.nextWeight}>
                {formatWarmUpWeight(
                  nextLift.warmUpSets[0].totalLoad,
                  bodyWeight,
                  nextLift.isBodyweightComponent,
                )}{' '}
                × {nextLift.warmUpSets[0].reps}
              </span>
            )}
            <button
              className={styles.nextBtn}
              type="button"
              onClick={() => setCurrentLiftIdx((i) => i + 1)}
            >
              →
            </button>
          </>
        ) : (
          <span className={styles.lastExercise}>Last exercise</span>
        )}
        {allLogged && (
          <button
            className={styles.finishBtn}
            type="button"
            onClick={() => router.push(`/cycle/${cycleNum}`)}
          >
            Finish workout
          </button>
        )}
      </footer>
    </div>
  );
}
