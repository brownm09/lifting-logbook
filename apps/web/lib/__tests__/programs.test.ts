import { PROGRAM_LENGTHS } from '@lifting-logbook/core';
import { PROGRAMS } from '../programs';

// Guards the single-source-of-truth wiring (issue #680): a program's advertised
// onboarding length must equal the canonical core registry length, so the two
// can never silently drift.
describe('PROGRAMS ↔ PROGRAM_LENGTHS reconciliation', () => {
  it('derives advertised weeks from the canonical registry for every registered program', () => {
    for (const [id, meta] of Object.entries(PROGRAM_LENGTHS)) {
      const card = PROGRAMS.find((p) => p.id === id);
      // Some registry entries (e.g. the seed program '5-3-1') have no onboarding
      // card; only reconcile the ones that appear in both.
      if (!card) continue;
      expect(card.weeks).toBe(meta.lengthWeeks);
    }
  });

  it('advertises Leangains as 12 weeks and RPT as 8 weeks', () => {
    expect(PROGRAMS.find((p) => p.id === 'leangains')?.weeks).toBe(12);
    expect(PROGRAMS.find((p) => p.id === 'rpt')?.weeks).toBe(8);
  });
});
