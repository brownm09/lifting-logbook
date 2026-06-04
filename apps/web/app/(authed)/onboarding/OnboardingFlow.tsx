'use client';

import { useMemo, useState, useTransition } from 'react';
import styles from './onboarding.module.css';
import {
  brzycki1RM,
  DEFAULT_LIFTS,
  type DiscoveryMethod,
  type LiftRow,
} from './lib';
import type { Experience } from '@/lib/programs';
import { StepMethod } from './steps/StepMethod';
import { StepLifts } from './steps/StepLifts';
import { StepConfirm } from './steps/StepConfirm';
import { StepProgram } from './steps/StepProgram';
import { createFirstCycle } from './actions';

const STEP_LABELS = [
  'Choose Method',
  'Enter Lifts',
  'Confirm Maxes',
  'Choose Program',
];

export function OnboardingFlow({ catalog }: { catalog: string[] }) {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<DiscoveryMethod>('estimate');
  const [lifts, setLifts] = useState<LiftRow[]>(
    DEFAULT_LIFTS.map((lift) => ({ lift, weight: '', reps: '' })),
  );
  const [experience, setExperience] = useState<Experience>('beginner');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cycleError, setCycleError] = useState<string | null>(null);

  const canAdvanceFromLifts =
    lifts.length > 0 &&
    lifts.every((row) => {
      if (method === 'manual') return Number(row.weight) > 0;
      return Number(row.weight) > 0 && Number(row.reps) > 0;
    });

  const computedMaxes = useMemo(() => {
    return lifts.map((row) => {
      const w = Number(row.weight);
      const r = Number(row.reps);
      const oneRm = method === 'manual' ? Math.round(w) : brzycki1RM(w, r);
      return { lift: row.lift, oneRm };
    });
  }, [lifts, method]);

  function updateLift(index: number, field: keyof Omit<LiftRow, 'lift'>, value: string) {
    setLifts((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addLift(lift: string) {
    setLifts((prev) =>
      prev.some((row) => row.lift === lift)
        ? prev
        : [...prev, { lift, weight: '', reps: '' }],
    );
  }

  function removeLift(index: number) {
    setLifts((prev) => prev.filter((_, i) => i !== index));
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleConfirm() {
    if (!selectedProgramId) return;
    setCycleError(null);
    const maxes = computedMaxes.filter((m) => m.oneRm > 0);
    startTransition(async () => {
      const result = await createFirstCycle(selectedProgramId, maxes);
      if (result && !result.ok) {
        setCycleError(result.error);
      }
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Get Started</h1>
          <p className={styles.headerSubtitle}>
            Step {step + 1} of {STEP_LABELS.length} · {STEP_LABELS[step]}
          </p>
          <nav className={styles.progressDots} aria-label="Onboarding progress">
            {STEP_LABELS.map((label, i) => {
              const dotClass = [
                styles.dot,
                i === step ? styles.dotActive : '',
                i < step ? styles.dotDone : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <span
                  key={label}
                  className={dotClass}
                  aria-current={i === step ? 'step' : undefined}
                  aria-label={label}
                />
              );
            })}
          </nav>
        </header>

        <section className={styles.body}>
          {step === 0 && <StepMethod method={method} onSelect={setMethod} />}
          {step === 1 && (
            <StepLifts
              method={method}
              lifts={lifts}
              catalog={catalog}
              onChange={updateLift}
              onAdd={addLift}
              onRemove={removeLift}
            />
          )}
          {step === 2 && <StepConfirm maxes={computedMaxes} />}
          {step === 3 && (
            <StepProgram
              experience={experience}
              selectedProgramId={selectedProgramId}
              isPending={isPending}
              cycleError={cycleError}
              onExperienceChange={(level) => {
                setExperience(level);
                setSelectedProgramId(null);
              }}
              onSelectProgram={(id) => {
                setSelectedProgramId(id);
              }}
              onClearSelection={() => setSelectedProgramId(null)}
              onConfirm={handleConfirm}
            />
          )}
        </section>

        <div className={styles.actionRow}>
          {step > 0 && step < 3 && (
            <button type="button" className={styles.btnSecondary} onClick={goBack}>
              Back
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={goNext}
              disabled={step === 1 ? !canAdvanceFromLifts : false}
            >
              {step === 2 ? 'Continue to Programs' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
