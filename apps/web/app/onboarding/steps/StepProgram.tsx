'use client';

import styles from '../onboarding.module.css';
import { PROGRAMS, type Experience, type Program } from '../programs';

const EXPERIENCE_LEVELS: Experience[] = ['beginner', 'intermediate', 'advanced'];

type Props = {
  experience: Experience;
  selectedProgramId: string | null;
  confirmed: boolean;
  onExperienceChange: (level: Experience) => void;
  onSelectProgram: (id: string) => void;
  onClearSelection: () => void;
  onConfirm: () => void;
};

export function StepProgram({
  experience,
  selectedProgramId,
  confirmed,
  onExperienceChange,
  onSelectProgram,
  onClearSelection,
  onConfirm,
}: Props) {
  const visiblePrograms = PROGRAMS.filter((p) => p.experience === experience);
  const selectedProgram: Program | null =
    PROGRAMS.find((p) => p.id === selectedProgramId) ?? null;

  return (
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
        {EXPERIENCE_LEVELS.map((level) => {
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
              onClick={() => onExperienceChange(level)}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          );
        })}
      </div>

      {selectedProgram ? (
        <div className={styles.programDetail}>
          <div className={styles.programDetailHeader}>
            <h3 className={styles.programDetailName}>{selectedProgram.name}</h3>
            <span className={styles.programDetailMeta}>{selectedProgram.meta}</span>
          </div>
          <p className={styles.programDetailDescription}>
            {selectedProgram.description}
          </p>
          {confirmed ? (
            <div className={styles.successBanner}>
              <p className={styles.successTitle}>You’re all set.</p>
              <p className={styles.successBody}>
                {selectedProgram.name} is queued up for your first cycle. Wiring this to
                the API comes next.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={onClearSelection}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.btnSuccess}
                onClick={onConfirm}
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
              onClick={() => onSelectProgram(p.id)}
            >
              <span className={styles.programName}>{p.name}</span>
              <span className={styles.programMeta}>{p.meta}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
