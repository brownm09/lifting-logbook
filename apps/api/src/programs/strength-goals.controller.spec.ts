import { Test, TestingModule } from '@nestjs/testing';
import { IStrengthGoalRepository } from '../ports/IStrengthGoalRepository';
import { IRepositoryFactory } from '../ports/factory';
import { StrengthGoalNotFoundError } from '../ports/errors';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { StrengthGoalsController } from './strength-goals.controller';

const MOCK_USER = { id: 'test-user', email: 'test@example.com', provider: 'dev' };
const PROGRAM = '5-3-1';

describe('StrengthGoalsController', () => {
  let controller: StrengthGoalsController;
  let repo: jest.Mocked<IStrengthGoalRepository>;
  let factory: jest.Mocked<IRepositoryFactory>;

  beforeEach(async () => {
    repo = {
      getGoals: jest.fn(),
      upsertGoal: jest.fn(),
      deleteGoal: jest.fn(),
    };
    factory = { forUser: jest.fn().mockResolvedValue({ strengthGoal: repo }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StrengthGoalsController],
      providers: [{ provide: REPOSITORY_FACTORY, useValue: factory }],
    }).compile();

    controller = module.get(StrengthGoalsController);
  });

  describe('getGoals', () => {
    it('returns mapped relative goal', async () => {
      repo.getGoals.mockResolvedValue([
        { lift: 'Squat', goalType: 'relative', ratio: 1.75, unit: 'lbs', updatedAt: new Date('2026-05-01T00:00:00.000Z') },
      ]);

      const result = await controller.getGoals(PROGRAM, MOCK_USER);

      expect(factory.forUser).toHaveBeenCalledWith(MOCK_USER);
      expect(repo.getGoals).toHaveBeenCalledWith(PROGRAM);
      expect(result).toEqual([
        { lift: 'Squat', goalType: 'relative', ratio: 1.75, unit: 'lbs', updatedAt: '2026-05-01' },
      ]);
    });

    it('returns mapped absolute goal', async () => {
      repo.getGoals.mockResolvedValue([
        { lift: 'Bench Press', goalType: 'absolute', target: 225, unit: 'lbs', updatedAt: new Date('2026-05-01T00:00:00.000Z') },
      ]);

      const result = await controller.getGoals(PROGRAM, MOCK_USER);

      expect(result[0]).toEqual({ lift: 'Bench Press', goalType: 'absolute', target: 225, unit: 'lbs', updatedAt: '2026-05-01' });
      expect(result[0]).not.toHaveProperty('ratio');
    });

    it('returns empty array when no goals', async () => {
      repo.getGoals.mockResolvedValue([]);
      const result = await controller.getGoals(PROGRAM, MOCK_USER);
      expect(result).toEqual([]);
    });
  });

  describe('upsertGoal', () => {
    it('saves and returns a relative goal', async () => {
      const saved = { lift: 'Squat', goalType: 'relative' as const, ratio: 1.8, unit: 'lbs' as const, updatedAt: new Date('2026-05-02T00:00:00.000Z') };
      repo.upsertGoal.mockResolvedValue(saved);

      const result = await controller.upsertGoal(PROGRAM, 'Squat', { goalType: 'relative', ratio: 1.8, unit: 'lbs' }, MOCK_USER);

      expect(repo.upsertGoal).toHaveBeenCalledWith(
        PROGRAM,
        expect.objectContaining({ lift: 'Squat', goalType: 'relative', ratio: 1.8, unit: 'lbs' }),
      );
      expect(result).toEqual({ lift: 'Squat', goalType: 'relative', ratio: 1.8, unit: 'lbs', updatedAt: '2026-05-02' });
    });

    it('saves and returns an absolute goal', async () => {
      const saved = { lift: 'Deadlift', goalType: 'absolute' as const, target: 495, unit: 'lbs' as const, updatedAt: new Date('2026-05-02T00:00:00.000Z') };
      repo.upsertGoal.mockResolvedValue(saved);

      const result = await controller.upsertGoal(PROGRAM, 'Deadlift', { goalType: 'absolute', target: 495, unit: 'lbs' }, MOCK_USER);

      expect(result).toEqual({ lift: 'Deadlift', goalType: 'absolute', target: 495, unit: 'lbs', updatedAt: '2026-05-02' });
      expect(result).not.toHaveProperty('ratio');
    });
  });

  describe('deleteGoal', () => {
    it('resolves without error on success', async () => {
      repo.deleteGoal.mockResolvedValue(undefined);
      await expect(controller.deleteGoal(PROGRAM, 'Squat', MOCK_USER)).resolves.toBeUndefined();
      expect(repo.deleteGoal).toHaveBeenCalledWith(PROGRAM, 'Squat');
    });

    it('propagates StrengthGoalNotFoundError', async () => {
      repo.deleteGoal.mockRejectedValue(new StrengthGoalNotFoundError('Squat'));
      await expect(controller.deleteGoal(PROGRAM, 'Squat', MOCK_USER)).rejects.toBeInstanceOf(StrengthGoalNotFoundError);
    });
  });
});
