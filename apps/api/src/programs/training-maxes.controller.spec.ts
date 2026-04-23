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
});
