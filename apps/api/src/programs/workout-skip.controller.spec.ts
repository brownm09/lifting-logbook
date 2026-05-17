import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IWorkoutSkipOverrideRepository } from '../ports/IWorkoutSkipOverrideRepository';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { WorkoutSkipController } from './workout-skip.controller';

const MOCK_USER = { id: 'u1', email: 'test@example.com', provider: 'dev' };

describe('WorkoutSkipController', () => {
  let controller: WorkoutSkipController;
  let skipRepo: jest.Mocked<IWorkoutSkipOverrideRepository>;

  beforeEach(async () => {
    skipRepo = {
      getSkipsForCycle: jest.fn(),
      skipWorkout: jest.fn().mockResolvedValue(undefined),
      unskipWorkout: jest.fn().mockResolvedValue(undefined),
    };
    const factory: jest.Mocked<IRepositoryFactory> = {
      forUser: jest.fn().mockResolvedValue({ workoutSkipOverride: skipRepo }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkoutSkipController],
      providers: [{ provide: REPOSITORY_FACTORY, useValue: factory }],
    }).compile();
    controller = module.get(WorkoutSkipController);
  });

  describe('skipWorkout', () => {
    it('throws 400 for non-numeric cycleNum', async () => {
      await expect(
        controller.skipWorkout('5-3-1', 'abc', '1', {}, MOCK_USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 for cycleNum < 1', async () => {
      await expect(
        controller.skipWorkout('5-3-1', '0', '1', {}, MOCK_USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 for non-numeric workoutNum', async () => {
      await expect(
        controller.skipWorkout('5-3-1', '1', 'abc', {}, MOCK_USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 for workoutNum < 1', async () => {
      await expect(
        controller.skipWorkout('5-3-1', '1', '0', {}, MOCK_USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls skipWorkout with parsed params and optional reason', async () => {
      await controller.skipWorkout('5-3-1', '2', '3', { reason: 'sick' }, MOCK_USER);
      expect(skipRepo.skipWorkout).toHaveBeenCalledWith('5-3-1', 2, 3, 'sick');
    });

    it('calls skipWorkout without reason when dto has none', async () => {
      await controller.skipWorkout('5-3-1', '2', '3', {}, MOCK_USER);
      expect(skipRepo.skipWorkout).toHaveBeenCalledWith('5-3-1', 2, 3, undefined);
    });
  });

  describe('unskipWorkout', () => {
    it('throws 400 for non-numeric cycleNum', async () => {
      await expect(
        controller.unskipWorkout('5-3-1', 'abc', '1', MOCK_USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 for workoutNum < 1', async () => {
      await expect(
        controller.unskipWorkout('5-3-1', '1', '0', MOCK_USER),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls unskipWorkout with parsed params', async () => {
      await controller.unskipWorkout('5-3-1', '2', '3', MOCK_USER);
      expect(skipRepo.unskipWorkout).toHaveBeenCalledWith('5-3-1', 2, 3);
    });
  });
});
