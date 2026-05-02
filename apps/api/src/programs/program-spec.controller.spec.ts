import { Test, TestingModule } from '@nestjs/testing';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { ProgramSpecController } from './program-spec.controller';

const MOCK_USER = { id: 'test-user', email: 'test@example.com', provider: 'dev' };

describe('ProgramSpecController', () => {
  let controller: ProgramSpecController;
  let repo: jest.Mocked<ILiftingProgramSpecRepository>;
  let factory: jest.Mocked<IRepositoryFactory>;

  beforeEach(async () => {
    repo = { getProgramSpec: jest.fn() };
    factory = {
      forUser: jest.fn().mockResolvedValue({ liftingProgramSpec: repo }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramSpecController],
      providers: [{ provide: REPOSITORY_FACTORY, useValue: factory }],
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

    const result = await controller.getProgramSpec('5-3-1', MOCK_USER);

    expect(factory.forUser).toHaveBeenCalledWith(MOCK_USER);
    expect(repo.getProgramSpec).toHaveBeenCalledWith('5-3-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.amrap).toBe(true);
    expect(result[0]?.lift).toBe('Squat');
  });
});
