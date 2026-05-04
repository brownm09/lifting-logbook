'use client';

import { useMemo, useState } from 'react';
import styles from './onboarding.module.css';
import {
  brzycki1RM,
  type DiscoveryMethod,
  type LiftEntry,
  type LiftKey,
} from './lib';
import type { Experience } from './programs';
import { StepMethod } from './steps/StepMethod';
import { StepLifts } from './steps/StepLifts';
import { StepConfirm } from './steps/StepConfirm';
import { StepProgram } from './steps/StepProgram';

const STEP_LABELS = [
  'Choose Method',
  'Enter Lifts',
  'Confirm Maxes',
  'Choose Program',
];

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<DiscoveryMethod>('estimate');
  const [lifts, setLifts] = useState<Record<LiftKey, LiftEntry>>({
    bench: { weight: '', reps: '' },
    squat: { weight: '', reps: '' },
    deadlift: { weight: '', reps: '' },
  });
  const [experience, setExperience] = useState<Experience>('beginner');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const canAdvanceFromLifts = (Object.keys(lifts) as LiftKey[]).every((k) => {
    const entry = lifts[k];
    if (method === 'manual') return Number(entry.weight) > 0;
    return Number(entry.weight) > 0 && Number(entry.reps) > 0;
  });

  const computedMaxes = useMemo(() => {
    return (Object.keys(lifts) as LiftKey[]).map((k) => {
      const entry = lifts[k];
      const w = Number(entry.weight);
      const r = Number(entry.reps);
      const oneRm = method === 'manual' ? Math.round(w) : brzycki1RM(w, r);
      return { lift: k, oneRm };
    });
  }, [lifts, method]);

  function updateLift(key: LiftKey, field: keyof LiftEntry, value: string) {
    setLifts((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
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
            <StepLifts method={method} lifts={lifts} onChange={updateLift} />
          )}
          {step === 2 && <StepConfirm maxes={computedMaxes} />}
          {step === 3 && (
            <StepProgram
              experience={experience}
              selectedProgramId={selectedProgramId}
              confirmed={confirmed}
              onExperienceChange={(level) => {
                setExperience(level);
                setSelectedProgramId(null);
              }}
              onSelectProgram={(id) => {
                setSelectedProgramId(id);
                setConfirmed(false);
              }}
              onClearSelection={() => setSelectedProgramId(null)}
              onConfirm={() => setConfirmed(true)}
            />
          )}
        </section>

        {!(step === 3 && confirmed) && (
          <div className={styles.actionRow}>
            {step > 0 && (
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
        )}
      </div>
    </main>
  );
}
