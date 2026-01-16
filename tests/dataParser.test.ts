import { loadCsvFixture } from './testUtils';
import { tableToObjects, parseTrainingMaxes, TrainingMax } from '../src/dataParser';

describe('dataParser', () => {
  it('converts training_maxes.csv to array of objects', () => {
    const data = loadCsvFixture('training_maxes.csv');
    const result = parseTrainingMaxes(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('dateUpdated');
    // Should be normalized to YYYY-MM-DD
    expect(result[0].dateUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result[0]).toHaveProperty('lift');
    expect(result[0]).toHaveProperty('weight');
  });

  it('tableToObjects returns correct keys with headerMap', () => {
    const data = [
      ['Date Updated', 'Lift', 'Weight'],
      ['2026-01-01', 'Squat', '100'],
      ['2026-01-01', 'Bench', '80']
    ];
    const headerMap = {
      'Date Updated': 'dateUpdated',
      'Lift': 'lift',
      'Weight': 'weight',
    };
    const result = tableToObjects(data, headerMap);
    expect(result).toEqual([
      { dateUpdated: '2026-01-01', lift: 'Squat', weight: '100' },
      { dateUpdated: '2026-01-01', lift: 'Bench', weight: '80' }
    ]);
  });

  it('parses rpt_program_spec.csv to array of RptProgramSpec objects', () => {
    const { parseRptProgramSpec } = require('../src/dataParser');
    const data = loadCsvFixture('rpt_program_spec.csv');
    const result = parseRptProgramSpec(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('offset');
    expect(result[0]).toHaveProperty('lift');
    expect(result[0]).toHaveProperty('increment');
    expect(result[0]).toHaveProperty('order');
    expect(result[0]).toHaveProperty('sets');
    expect(result[0]).toHaveProperty('reps');
    expect(result[0]).toHaveProperty('amrap');
    expect(result[0]).toHaveProperty('warmUpPct');
    expect(result[0]).toHaveProperty('wtDecrementPct');
    expect(result[0]).toHaveProperty('activation');
  });
});
