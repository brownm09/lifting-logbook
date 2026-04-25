import { Test, TestingModule } from '@nestjs/testing';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { LIFTING_PROGRAM_SPEC_REPOSITORY } from '../ports/tokens';
import { ProgramSpecController } from './program-spec.controller';

describe('ProgramSpecController', () => {
  let controller: ProgramSpecController;
  let repo: jest.Mocked<ILiftingProgramSpecRepository>;

  beforeEach(async () => {
    repo = { getProgramSpec: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramSpecController],
      providers: [{ provide: LIFTING_PROGRAM_SPEC_REPOSITORY, useValue: repo }],
    }).compile();
    controller = module.get(ProgramSpecController);
  });

  it('returns mapped program spec with normalized amrap boolean', async () => {
    repo.getProgramSpec.mockResolvedValue([
      {
        offset: 0,
        lift: 'Squat',
        increment: 5,
        order: 1,
        sets: 3,
        reps: 5,
        amrap: 'TRUE',
        warmUpPct: '0.4,0.5,0.6',
        wtDecrementPct: 0.1,
        activation: 'compound',
      },
    ]);

    const result = await controller.getProgramSpec('5-3-1');

    expect(repo.getProgramSpec).toHaveBeenCalledWith('5-3-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.amrap).toBe(true);
    expect(result[0]?.lift).toBe('Squat');
  });
});
