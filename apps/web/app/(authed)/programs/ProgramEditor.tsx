'use client';

import { useState, useTransition } from 'react';
import { LIFT_CATALOG } from '@lifting-logbook/core';
import { useRouter } from 'next/navigation';
import type { CustomProgramResponse, CustomProgramSpecRow } from '@lifting-logbook/types';
import { createCustomProgram, updateCustomProgram, switchProgram } from './actions';
import { TEMPLATE_BUILDERS } from '@/lib/programs';
import styles from './programs.module.css';

type Mode = 'new' | 'clone' | 'edit';

type Props = {
  mode: Mode;
  existing?: CustomProgramResponse;
  baseTemplateId?: string;
  activeProgram: string | null;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

const WEEK_LABELS: Record<number, string> = {
  1: 'Week 1',
  2: 'Week 2',
  3: 'Week 3',
};

const ALL_LIFTS: string[] = LIFT_CATALOG.map((l) => l.name as string);

const DEFAULT_ROW = (week: number, lift: string, order: number): CustomProgramSpecRow => ({
  week,
  offset: 0,
  lift,
  increment: 5,
  order,
  sets: 3,
  reps: 5,
  amrap: false,
  warmUpPct: '0.4,0.5,0.6',
  wtDecrementPct: 0.1,
  activation: 'compound',
});

function buildDefaultSpecs(lifts: string[]): CustomProgramSpecRow[] {
  const rows: CustomProgramSpecRow[] = [];
  for (const week of [1, 2, 3] as const) {
    lifts.forEach((lift, i) => {
      rows.push(DEFAULT_ROW(week, lift, i + 1));
    });
  }
  return rows;
}

function buildSpecsFromTemplate(templateId: string, lifts: string[]): CustomProgramSpecRow[] {
  const builder = TEMPLATE_BUILDERS[templateId];
  const seeded = builder ? builder() : null;
  if (seeded) {
    // Single-week repeating templates (maxWeek === 1) define one week's structure that
    // repeats unchanged. Expand to all three editor weeks so weeks 2 and 3 don't fall
    // through to DEFAULT_ROW when the user clones the template.
    const maxWeek = Math.max(...seeded.map((s) => s.week));
    const expanded =
      maxWeek === 1
        ? [1, 2, 3].flatMap((w) => seeded.map((s) => ({ ...s, week: w })))
        : seeded;
    const seededLifts = new Set(lifts);
    const filtered = expanded.filter((s) => seededLifts.has(s.lift));
    if (filtered.length > 0) return filtered.map((s) => ({ ...s, amrap: Boolean(s.amrap) }));
  }
  return buildDefaultSpecs(lifts);
}

export default function ProgramEditor({
  mode,
  existing,
  baseTemplateId,
  activeProgram: _activeProgram,
  onSaved,
  onCancel,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(
    mode === 'edit' ? (existing?.name ?? '') : mode === 'clone' ? `${existing?.name ?? ''} (copy)` : '',
  );
  const [description, setDescription] = useState(
    mode === 'edit' ? (existing?.description ?? '') : '',
  );

  const initialLifts = existing?.specs
    ? [...new Set(existing.specs.map((s) => s.lift))]
    : [];
  const [selectedLifts, setSelectedLifts] = useState<string[]>(initialLifts);

  const [specs, setSpecs] = useState<CustomProgramSpecRow[]>(() => {
    if (existing?.specs && existing.specs.length > 0) return existing.specs;
    if (baseTemplateId) return buildSpecsFromTemplate(baseTemplateId, initialLifts);
    return buildDefaultSpecs(initialLifts);
  });

  function toggleLift(lift: string) {
    setSelectedLifts((prev) => {
      const next = prev.includes(lift)
        ? prev.filter((l) => l !== lift)
        : [...prev, lift];
      // Rebuild spec rows to match new lift selection
      rebuildSpecs(next);
      return next;
    });
  }

  function rebuildSpecs(lifts: string[]) {
    setSpecs((prev) => {
      const rows: CustomProgramSpecRow[] = [];
      for (const week of [1, 2, 3] as const) {
        lifts.forEach((lift, i) => {
          const existing_ = prev.find((s) => s.week === week && s.lift === lift);
          rows.push(existing_ ?? DEFAULT_ROW(week, lift, i + 1));
        });
      }
      return rows;
    });
  }

  function updateSpec(week: number, lift: string, field: keyof CustomProgramSpecRow, value: string | number | boolean) {
    setSpecs((prev) =>
      prev.map((s) =>
        s.week === week && s.lift === lift ? { ...s, [field]: value } : s,
      ),
    );
  }

  function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (selectedLifts.length === 0) { setError('Select at least one lift.'); return; }
    setError(null);

    startTransition(async () => {
      try {
        let saved: CustomProgramResponse;
        if (mode === 'edit' && existing) {
          saved = await updateCustomProgram(existing.id, { name: name.trim(), description: description.trim() || undefined, specs });
        } else {
          saved = await createCustomProgram({
            name: name.trim(),
            description: description.trim() || undefined,
            baseTemplate: baseTemplateId,
            specs,
          });
        }
        onSaved(saved.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save program.');
      }
    });
  }

  async function handleSaveAndSwitch() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (selectedLifts.length === 0) { setError('Select at least one lift.'); return; }
    setError(null);

    startTransition(async () => {
      try {
        let saved: CustomProgramResponse;
        if (mode === 'edit' && existing) {
          saved = await updateCustomProgram(existing.id, { name: name.trim(), description: description.trim() || undefined, specs });
        } else {
          saved = await createCustomProgram({
            name: name.trim(),
            description: description.trim() || undefined,
            baseTemplate: baseTemplateId,
            specs,
          });
        }
        const result = await switchProgram(saved.id);
        router.push(`/cycle/${result.cycleNum}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save or switch program.');
      }
    });
  }

  const weeks = [1, 2, 3];

  return (
    <div className={styles.editorForm}>
      <div className={styles.formField}>
        <label className={styles.formLabel} htmlFor="prog-name">Program Name</label>
        <input
          id="prog-name"
          className={styles.formInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Custom 5/3/1"
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel} htmlFor="prog-desc">Description (optional)</label>
        <textarea
          id="prog-desc"
          className={styles.formTextarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your program…"
        />
      </div>

      <div className={styles.formField}>
        <p className={styles.formLabel}>Lifts</p>
        <div className={styles.liftCheckboxList}>
          {ALL_LIFTS.map((lift) => (
            <label key={lift} className={styles.liftCheckbox}>
              <input
                type="checkbox"
                checked={selectedLifts.includes(lift)}
                onChange={() => toggleLift(lift)}
              />
              {lift}
            </label>
          ))}
        </div>
      </div>

      {selectedLifts.length > 0 && (
        <div className={styles.formField}>
          <p className={styles.formLabel}>Weekly Spec</p>
          <p className={styles.infoText}>Sets, reps, and progression per lift per week.</p>
          <div className={styles.specTableWrapper}>
            <table className={styles.specTable}>
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Lift</th>
                  <th>Sets</th>
                  <th>Reps</th>
                  <th>AMRAP</th>
                  <th>Increment</th>
                  <th>Warmup %</th>
                </tr>
              </thead>
              <tbody>
                {weeks.flatMap((week) =>
                  selectedLifts.map((lift) => {
                    const row = specs.find((s) => s.week === week && s.lift === lift) ??
                      DEFAULT_ROW(week, lift, selectedLifts.indexOf(lift) + 1);
                    return (
                      <tr key={`${week}-${lift}`}>
                        <td>{WEEK_LABELS[week]}</td>
                        <td style={{ textAlign: 'left' }}>{lift}</td>
                        <td>
                          <input
                            className={styles.specInput}
                            type="number"
                            min={1}
                            max={20}
                            value={row.sets}
                            onChange={(e) => updateSpec(week, lift, 'sets', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.specInput}
                            type="number"
                            min={1}
                            max={20}
                            value={row.reps}
                            onChange={(e) => updateSpec(week, lift, 'reps', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.amrap}
                            onChange={(e) => updateSpec(week, lift, 'amrap', e.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.specInput}
                            type="number"
                            min={0}
                            step={2.5}
                            value={row.increment}
                            onChange={(e) => updateSpec(week, lift, 'increment', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.specInput}
                            style={{ width: '120px' }}
                            type="text"
                            value={row.warmUpPct}
                            onChange={(e) => updateSpec(week, lift, 'warmUpPct', e.target.value)}
                            placeholder="0.4,0.5,0.6"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className={styles.errorNote}>{error}</p>}

      <div className={styles.programActions}>
        <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
        <button type="button" className={styles.btnSecondary} onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleSaveAndSwitch} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save & Switch to This Program'}
        </button>
      </div>
    </div>
  );
}
