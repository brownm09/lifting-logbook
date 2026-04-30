import { Test, TestingModule } from '@nestjs/testing';
import { ITrainingMaxRepository } from '../ports/ITrainingMaxRepository';
import { TRAINING_MAX_REPOSITORY } from '../ports/tokens';
import { TrainingMaxesController } from './training-maxes.controller';

describe('TrainingMaxesController', () => {
  let controller: TrainingMaxesController;
  let repo: jest.Mocked<ITrainingMaxRepository>;

  beforeEach(async () => {
    repo = { getTrainingMaxes: jest.fn(), saveTrainingMaxes: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrainingMaxesController],
      providers: [{ provide: TRAINING_MAX_REPOSITORY, useValue: repo }],
    }).compile();
    controller = module.get(TrainingMaxesController);
  });

  it('returns mapped training maxes with unit and ISO date', async () => {
    repo.getTrainingMaxes.mockResolvedValue([
      {
        lift: 'Squat',
        weight: 315,
        dateUpdated: new Date('2026-04-20T00:00:00.000Z'),
      },
    ]);

    const result = await controller.getTrainingMaxes('5-3-1');

    expect(repo.getTrainingMaxes).toHaveBeenCalledWith('5-3-1');
    expect(result).toEqual([
      { lift: 'Squat', weight: 315, unit: 'lbs', dateUpdated: '2026-04-20' },
    ]);
  });

  describe('updateTrainingMaxes', () => {
    it('merges incoming maxes into existing set and returns updated list', async () => {
      repo.getTrainingMaxes.mockResolvedValue([
        { lift: 'Squat', weight: 315, dateUpdated: new Date('2026-04-20') },
        { lift: 'Bench Press', weight: 225, dateUpdated: new Date('2026-04-20') },
      ]);
      repo.saveTrainingMaxes.mockResolvedValue(undefined);

      const result = await controller.updateTrainingMaxes('5-3-1', {
        maxes: [{ lift: 'Squat', weight: 325, unit: 'lbs' }],
      });

      expect(repo.saveTrainingMaxes).toHaveBeenCalledWith(
        '5-3-1',
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 325 }),
          expect.objectContaining({ lift: 'Bench Press', weight: 225 }),
        ]),
      );
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 325, unit: 'lbs' }),
          expect.objectContaining({ lift: 'Bench Press', weight: 225, unit: 'lbs' }),
        ]),
      );
    });

    it('adds a new lift not previously recorded', async () => {
      repo.getTrainingMaxes.mockResolvedValue([]);
      repo.saveTrainingMaxes.mockResolvedValue(undefined);

      const result = await controller.updateTrainingMaxes('5-3-1', {
        maxes: [{ lift: 'Deadlift', weight: 405, unit: 'lbs' }],
      });

      expect(repo.saveTrainingMaxes).toHaveBeenCalledWith(
        '5-3-1',
        [expect.objectContaining({ lift: 'Deadlift', weight: 405 })],
      );
      expect(result).toEqual([
        expect.objectContaining({ lift: 'Deadlift', weight: 405, unit: 'lbs' }),
      ]);
    });
  });
});
