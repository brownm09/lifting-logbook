'use client';

import { useMemo, useState } from 'react';
import styles from './onboarding.module.css';

type DiscoveryMethod = 'estimate' | 'test' | 'manual';

type LiftKey = 'bench' | 'squat' | 'deadlift';

type LiftEntry = { weight: string; reps: string };

type Experience = 'beginner' | 'intermediate' | 'advanced';

type Program = {
  id: string;
  name: string;
  experience: Experience;
  meta: string;
  description: string;
};

const PROGRAMS: Program[] = [
  {
    id: 'starting-strength',
    name: 'Starting Strength',
    experience: 'beginner',
    meta: '3 days/week · Linear progression',
    description:
      'Mark Rippetoe’s linear progression program. Squat, press, deadlift, bench, and power clean — add weight every session until stalls require a deload.',
  },
  {
    id: 'stronglifts',
    name: 'StrongLifts 5×5',
    experience: 'beginner',
    meta: '3 days/week · 5×5 alternating workouts',
    description:
      'Two alternating workouts (A/B) with five compound lifts at 5 sets of 5 reps. Add 5 lb every session until plateau.',
  },
  {
    id: 'rpt',
    name: 'Reverse Pyramid Training (Lyle/Eric Helms)',
    experience: 'intermediate',
    meta: '3-4 days/week · Top-set focused',
    description:
      'Heaviest set first, then back-off sets at reduced load. Emphasizes intensity on the first work set with clear progression rules tied to top-set rep targets.',
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    experience: 'intermediate',
    meta: '6 days/week · Hypertrophy split',
    description:
      'Classic split that lets you train each major movement pattern twice per week. Volume scales with recovery; popular as PHUL/PHAT variants too.',
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    experience: 'intermediate',
    meta: '4 days/week · Balanced split',
    description:
      'Upper body and lower body alternated four days per week. Good middle ground between full-body frequency and bodypart split volume.',
  },
  {
    id: '531',
    name: '5/3/1',
    experience: 'intermediate',
    meta: '4 days/week · Wave-loaded',
    description:
      'Jim Wendler’s 4-week wave with a top set on each main lift, then assistance work. Conservative training maxes (90% of 1RM) drive long-term progress.',
  },
  {
    id: '531-bbb',
    name: '5/3/1 Boring But Big',
    experience: 'intermediate',
    meta: '4 days/week · BBB volume template',
    description:
      'Standard 5/3/1 main work followed by 5×10 of the same lift (or its complement) at 50–70% TM. High-volume hypertrophy template most lifters can recover from.',
  },
  {
    id: '531-forever',
    name: '5/3/1 Forever',
    experience: 'advanced',
    meta: '3-5 days/week · Multi-cycle leader/anchor',
    description:
      'The latest evolution of 5/3/1 organized into "leader" volume blocks and "anchor" intensity blocks. Drops the deload week in favor of programmed light days.',
  },
  {
    id: 'leangains',
    name: 'Leangains (Berkhan)',
    experience: 'intermediate',
    meta: '3 days/week · RPT + IF protocol',
    description:
      'Reverse-pyramid lifting paired with intermittent fasting. Three compound-focused sessions per week with macros tuned to training and rest days.',
  },
  {
    id: 'conjugate',
    name: 'Westside Conjugate',
    experience: 'advanced',
    meta: '4 days/week · Max effort + dynamic effort',
    description:
      'Westside Barbell’s max-effort and dynamic-effort waves rotated across upper and lower days. Heavy emphasis on accommodating resistance and weak-point training.',
  },
  {
    id: 'smolov',
    name: 'Smolov (Squat)',
    experience: 'advanced',
    meta: '4 days/week · 13-week squat cycle',
    description:
      'Soviet squat specialization program. Brutal intro phase, base mesocycle, switching, and intense mesocycle. Use only with deep recovery support.',
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut Method',
    experience: 'advanced',
    meta: '4 days/week · Block periodization',
    description:
      'Chad Wesley Smith’s block model with accumulation, intensification, and realization phases. Long-term progression with built-in volume waves.',
  },
  {
    id: 'creeping-death-2',
    name: 'Creeping Death II',
    experience: 'advanced',
    meta: '4 days/week · 5/3/1 program of programs',
    description:
      'A long-haul 5/3/1 template that stretches each cycle’s pace and increases supplemental work over time. Built for advanced lifters chasing slow PRs.',
  },
];

const STEP_LABELS = [
  'Choose Method',
  'Enter Lifts',
  'Confirm Maxes',
  'Choose Program',
];

function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  const denom = 37 - reps;
  if (denom <= 0) return 0;
  return Math.round((weight * 36) / denom);
}

const LIFT_LABELS: Record<LiftKey, string> = {
  bench: 'Bench Press',
  squat: 'Back Squat',
  deadlift: 'Deadlift',
};

const METHOD_OPTIONS: { id: DiscoveryMethod; title: string; description: string }[] = [
  {
    id: 'estimate',
    title: 'Estimate from a recent lift',
    description:
      'Enter a recent set (weight × reps) and we’ll calculate your 1RM with the Brzycki formula.',
  },
  {
    id: 'test',
    title: 'Run a Test Week',
    description:
      'Spend a week working up to heavy singles in each lift. Best accuracy for experienced lifters.',
  },
  {
    id: 'manual',
    title: 'Enter manually',
    description:
      'You already know your 1RMs. Enter them directly and we’ll set training maxes at 90%.',
  },
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

  const visiblePrograms = PROGRAMS.filter((p) => p.experience === experience);
  const selectedProgram = PROGRAMS.find((p) => p.id === selectedProgramId) ?? null;

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
          <nav
            className={styles.progressDots}
            aria-label="Onboarding progress"
          >
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
          {step === 0 && (
            <>
              <h2 className={styles.stepTitle}>How do you want to find your maxes?</h2>
              <p className={styles.stepHint}>
                Pick the option that matches your training history.
              </p>
              <div className={styles.optionList}>
                {METHOD_OPTIONS.map((opt) => {
                  const cls = [
                    styles.option,
                    method === opt.id ? styles.optionSelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      className={cls}
                      onClick={() => setMethod(opt.id)}
                      aria-pressed={method === opt.id}
                    >
                      <span className={styles.optionTitle}>{opt.title}</span>
                      <span className={styles.optionDescription}>
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className={styles.stepTitle}>Enter your lifts</h2>
              <p className={styles.stepHint}>
                {method === 'manual'
                  ? 'Enter your current 1-rep max for each lift.'
                  : 'Enter a recent heavy set (weight × reps) for each lift.'}
              </p>
              <div className={styles.dataRows}>
                {(Object.keys(LIFT_LABELS) as LiftKey[]).map((key) => (
                  <div key={key} className={styles.dataRow}>
                    <span className={styles.dataRowLabel}>
                      {LIFT_LABELS[key]}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="Weight"
                      className={styles.numberInput}
                      value={lifts[key].weight}
                      onChange={(e) => updateLift(key, 'weight', e.target.value)}
                      aria-label={`${LIFT_LABELS[key]} weight`}
                    />
                    <span className={styles.unitLabel}>lb</span>
                    {method !== 'manual' && (
                      <>
                        <span className={styles.unitLabel}>×</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="20"
                          placeholder="Reps"
                          className={styles.numberInput}
                          value={lifts[key].reps}
                          onChange={(e) => updateLift(key, 'reps', e.target.value)}
                          aria-label={`${LIFT_LABELS[key]} reps`}
                        />
                        <span className={styles.unitLabel}>reps</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className={styles.infoBox}>
                We use the Brzycki formula:{' '}
                <strong>1RM = weight × 36 ÷ (37 − reps)</strong>. Stay under
                10 reps for accuracy.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className={styles.stepTitle}>Confirm your training maxes</h2>
              <p className={styles.stepHint}>
                Estimated 1-rep maxes based on what you entered. Training maxes
                use 90% of the 1RM.
              </p>
              <div className={styles.maxesGrid}>
                {computedMaxes.map(({ lift, oneRm }) => (
                  <div key={lift} className={styles.maxRow}>
                    <span className={styles.maxRowLabel}>
                      {LIFT_LABELS[lift]}
                    </span>
                    <span className={styles.maxRowValue}>
                      {oneRm > 0 ? `${oneRm} lb` : '—'}
                      {oneRm > 0 && (
                        <span
                          className={styles.unitLabel}
                          style={{ marginLeft: 'var(--space-2)' }}
                        >
                          (TM {Math.round(oneRm * 0.9)} lb)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className={styles.stepTitle}>Choose a program</h2>
              <p className={styles.stepHint}>
                Filter by experience, then pick a template to see details.
              </p>
              <div
                className={styles.experienceFilter}
                role="tablist"
                aria-label="Experience level"
              >
                {(['beginner', 'intermediate', 'advanced'] as Experience[]).map(
                  (level) => {
                    const cls = [
                      styles.filterChip,
                      experience === level ? styles.filterChipActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <button
                        key={level}
                        type="button"
                        role="tab"
                        aria-selected={experience === level}
                        className={cls}
                        onClick={() => {
                          setExperience(level);
                          setSelectedProgramId(null);
                        }}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    );
                  },
                )}
              </div>

              {selectedProgram ? (
                <div className={styles.programDetail}>
                  <div className={styles.programDetailHeader}>
                    <h3 className={styles.programDetailName}>
                      {selectedProgram.name}
                    </h3>
                    <span className={styles.programDetailMeta}>
                      {selectedProgram.meta}
                    </span>
                  </div>
                  <p className={styles.programDetailDescription}>
                    {selectedProgram.description}
                  </p>
                  {confirmed ? (
                    <div className={styles.successBanner}>
                      <p className={styles.successTitle}>You’re all set.</p>
                      <p className={styles.successBody}>
                        {selectedProgram.name} is queued up for your first cycle.
                        Wiring this to the API comes next.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => setSelectedProgramId(null)}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className={styles.btnSuccess}
                        onClick={() => setConfirmed(true)}
                      >
                        Choose This Program
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.programList}>
                  {visiblePrograms.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.programItem}
                      onClick={() => {
                        setSelectedProgramId(p.id);
                        setConfirmed(false);
                      }}
                    >
                      <span className={styles.programName}>{p.name}</span>
                      <span className={styles.programMeta}>{p.meta}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {!(step === 3 && confirmed) && (
          <div className={styles.actionRow}>
            {step > 0 && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={goBack}
              >
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
