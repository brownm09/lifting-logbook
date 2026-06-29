import { TEMPLATE_BUILDERS, SEED_PROGRAM, SEED_LEANGAINS, seedProgramSpec, seedLeangainsSpec } from '@/lib/programs';

describe('TEMPLATE_BUILDERS dispatch map', () => {
  it('maps SEED_PROGRAM key to seedProgramSpec', () => {
    expect(TEMPLATE_BUILDERS[SEED_PROGRAM]).toBe(seedProgramSpec);
  });

  it('maps SEED_LEANGAINS key to seedLeangainsSpec', () => {
    expect(TEMPLATE_BUILDERS[SEED_LEANGAINS]).toBe(seedLeangainsSpec);
  });

  it('returns undefined for an unknown template ID', () => {
    expect(TEMPLATE_BUILDERS['unknown-template']).toBeUndefined();
  });
});
