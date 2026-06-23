'use client';

import { useMemo, useState } from 'react';
import type { UserWorkoutSchedule } from '@lifting-logbook/types';
import {
  PROGRAMS,
  type Experience,
  type Goal,
  type Program,
  type Purpose,
} from '@/lib/programs';
import SwitchProgramDialog from './SwitchProgramDialog';
import styles from './programs.module.css';

const PURPOSE_COLORS: Record<Purpose, string> = {
  Strength: '#e74c3c',
  Hypertrophy: '#3498db',
  Bodybuilding: '#9b59b6',
  Powerlifting: '#c0392b',
  Sports: '#27ae60',
  Beginner: '#27ae60',
  Intermediate: '#f39c12',
};

const EXPERIENCE_LEVELS: Experience[] = ['beginner', 'intermediate', 'advanced'];
const GOAL_OPTIONS: { label: string; value: 'all' | Goal }[] = [
  { label: 'All Goals', value: 'all' },
  { label: '💪 Strength', value: 'strength' },
  { label: '📈 Muscle Gain', value: 'muscle-gain' },
  { label: '⚖️ Body Composition', value: 'body-composition' },
  { label: '🔥 Fat Loss', value: 'fat-loss' },
];

type Props = {
  activeProgram: string | null;
  workoutSchedule: UserWorkoutSchedule | null;
};

export default function BrowseTab({ activeProgram, workoutSchedule }: Props) {
  const [experienceFilter, setExperienceFilter] = useState<Experience | 'all'>('all');
  const [goalFilter, setGoalFilter] = useState<'all' | Goal>('all');
  // Unavailable ("coming soon") presets are hidden by default; this toggle reveals
  // them. Revealed presets remain non-selectable — see renderProgram's availability
  // gate (Choose This Program only renders when p.available).
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [switchTarget, setSwitchTarget] = useState<Program | null>(null);

  const filteredPrograms = useMemo(() => {
    return PROGRAMS.filter((p) => {
      if (!showUnavailable && !p.available) return false;
      if (experienceFilter !== 'all' && p.experience !== experienceFilter) return false;
      if (goalFilter !== 'all' && !p.goals.includes(goalFilter)) return false;
      return true;
    });
  }, [experienceFilter, goalFilter, showUnavailable]);

  const grouped = useMemo(() => {
    const tiers: Record<Experience, Program[]> = { beginner: [], intermediate: [], advanced: [] };
    for (const p of filteredPrograms) tiers[p.experience].push(p);
    return tiers;
  }, [filteredPrograms]);

  // Programs hidden purely by the default-on availability filter — i.e. would match
  // the current experience/goal selection if revealed. Drives the empty-state hint so
  // a user whose filter matches only "coming soon" presets is pointed at the toggle
  // rather than left staring at a blank list (RPT is the only available preset today,
  // so any goal it lacks empties the default tier view).
  const hiddenUnavailableCount = useMemo(
    () =>
      showUnavailable
        ? 0
        : PROGRAMS.filter(
            (p) =>
              !p.available &&
              (experienceFilter === 'all' || p.experience === experienceFilter) &&
              (goalFilter === 'all' || p.goals.includes(goalFilter)),
          ).length,
    [experienceFilter, goalFilter, showUnavailable],
  );

  const showTiers = experienceFilter === 'all';

  function toggleDetail(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function renderProgram(p: Program) {
    const isActive = p.id === activeProgram;
    const isExpanded = expandedId === p.id;
    return (
      <div
        key={p.id}
        className={`${styles.programCard} ${isActive ? styles.programCardActive : ''}`}
      >
        <div className={styles.programCardHeader}>
          <span className={styles.programName}>{p.name}</span>
          <span className={styles.programMeta}>{p.meta}</span>
          {isActive && <span className={styles.currentBadge}>Current</span>}
        </div>

        <div className={styles.programActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => toggleDetail(p.id)}
          >
            {isExpanded ? 'Hide Details' : 'View Details'}
          </button>
          {!isActive && p.available && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setSwitchTarget(p)}
            >
              Choose This Program
            </button>
          )}
          {!p.available && (
            <span className={styles.comingSoon}>⏳ Coming soon</span>
          )}
        </div>

        {isExpanded && (
          <div className={styles.programDetail}>
            <p className={styles.programDescription}>{p.description}</p>
            <div className={styles.purposeTags}>
              {p.purposes.map((tag) => (
                <span
                  key={tag}
                  className={styles.purposeTag}
                  style={{ backgroundColor: PURPOSE_COLORS[tag] }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className={styles.metaGrid}>
              <div className={styles.metaCell}>
                <div className={styles.metaCellLabel}>Duration</div>
                <div className={styles.metaCellValue}>{p.weeks}w</div>
              </div>
              <div className={styles.metaCell}>
                <div className={styles.metaCellLabel}>Frequency</div>
                <div className={styles.metaCellValue}>{p.daysPerWeek}×/week</div>
              </div>
            </div>
            <p className={styles.sectionLabel}>Progression</p>
            <p className={styles.infoText}>{p.progression}</p>
            <p className={styles.sectionLabel}>Deload Strategy</p>
            <p className={styles.infoText}>{p.deloads}</p>
            <p className={styles.sectionLabel}>Core Lifts</p>
            <div className={styles.liftChips}>
              {p.lifts.map((l) => <span key={l} className={styles.liftChip}>{l}</span>)}
            </div>
            <p className={styles.sectionLabel}>Sample Schedule</p>
            <div className={styles.scheduleList}>
              {p.schedule.map((day) => (
                <div key={day.day} className={styles.scheduleDay}>
                  <span className={styles.scheduleDayName}>{day.day}:</span>
                  {day.lifts.join(' · ')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Shared by both the tier-grouped and flat-list renders so an empty result set
  // always explains itself (and points at the "Show coming soon" toggle when the
  // availability filter is what hid every match).
  const emptyState = (
    <p className={styles.emptyState}>
      {hiddenUnavailableCount > 0
        ? `No available programs match this filter. Turn on “Show coming soon” to preview ${hiddenUnavailableCount} in development.`
        : 'No programs match this filter.'}
    </p>
  );

  return (
    <>
      {/* Experience filter */}
      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.chip} ${experienceFilter === 'all' ? styles.chipActive : ''}`}
          onClick={() => setExperienceFilter('all')}
        >
          All Levels
        </button>
        {EXPERIENCE_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`${styles.chip} ${experienceFilter === level ? styles.chipActive : ''}`}
            onClick={() => setExperienceFilter(level)}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      {/* Goal filter */}
      <div className={styles.filterRow}>
        {GOAL_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            className={`${styles.chip} ${goalFilter === value ? styles.chipActive : ''}`}
            onClick={() => setGoalFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Availability toggle */}
      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.chip} ${showUnavailable ? styles.chipActive : ''}`}
          aria-pressed={showUnavailable}
          onClick={() => setShowUnavailable((v) => !v)}
        >
          Show coming soon
        </button>
      </div>

      {/* Program list */}
      {showTiers ? (
        filteredPrograms.length > 0 ? (
          EXPERIENCE_LEVELS.map((tier) => {
            const programs = grouped[tier];
            if (programs.length === 0) return null;
            return (
              <div key={tier}>
                <p className={styles.catalogTierLabel}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </p>
                <div className={styles.programList}>
                  {programs.map(renderProgram)}
                </div>
              </div>
            );
          })
        ) : (
          emptyState
        )
      ) : (
        <div className={styles.programList}>
          {filteredPrograms.length > 0 ? filteredPrograms.map(renderProgram) : emptyState}
        </div>
      )}

      {switchTarget && (
        <SwitchProgramDialog
          programId={switchTarget.id}
          programName={switchTarget.name}
          currentProgramId={activeProgram}
          workoutSchedule={workoutSchedule}
          onClose={() => setSwitchTarget(null)}
        />
      )}
    </>
  );
}
