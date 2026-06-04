import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCustomProgramDto } from './create-custom-program.dto';

const VALID_SPEC_ROW = {
  week: 1,
  offset: 0,
  lift: 'Bench Press',
  increment: 5,
  order: 1,
  sets: 3,
  reps: 5,
  amrap: false,
  warmUpPct: '0.4,0.5,0.6',
  wtDecrementPct: 0.1,
  activation: 'none',
};

function dtoWith(specOverride: Record<string, unknown>): CreateCustomProgramDto {
  return plainToInstance(CreateCustomProgramDto, {
    name: 'My Program',
    specs: [{ ...VALID_SPEC_ROW, ...specOverride }],
  });
}

async function flattenConstraintKeys(dto: CreateCustomProgramDto): Promise<string[]> {
  const errors = await validate(dto, { whitelist: true });
  const keys: string[] = [];
  const walk = (errs: typeof errors): void => {
    for (const e of errs) {
      if (e.constraints) keys.push(...Object.keys(e.constraints));
      if (e.children?.length) walk(e.children);
    }
  };
  walk(errors);
  return keys;
}

describe('CreateCustomProgramDto validation', () => {
  it('accepts a well-formed program', async () => {
    const errors = await validate(dtoWith({}), { whitelist: true });
    expect(errors).toHaveLength(0);
  });

  it('rejects a zero increment (would make MROUND divide by zero)', async () => {
    expect(await flattenConstraintKeys(dtoWith({ increment: 0 }))).toContain('isPositive');
  });

  it('rejects a negative increment', async () => {
    expect(await flattenConstraintKeys(dtoWith({ increment: -5 }))).toContain('isPositive');
  });

  it('rejects a wtDecrementPct above 1', async () => {
    expect(await flattenConstraintKeys(dtoWith({ wtDecrementPct: 1.5 }))).toContain('max');
  });

  it('rejects a negative wtDecrementPct', async () => {
    expect(await flattenConstraintKeys(dtoWith({ wtDecrementPct: -0.1 }))).toContain('min');
  });
});
