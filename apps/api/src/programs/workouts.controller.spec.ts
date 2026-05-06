import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Weekday } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { IWorkoutDateOverrideRepository } from '../ports/IWorkoutDateOverrideRepository';
import { IWorkoutLiftOverrideRepository } from '../ports/IWorkoutLiftOverrideRepository';
import { IWorkoutRepository } from '../ports/IWorkoutRepository';
import { WorkoutNotFoundError } from '../ports/errors';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { WorkoutsController } from './workouts.controller';

const MOCK_USER = { id: 'test-user', email: 'test@example.com', provider: 'dev' };

describe('WorkoutsController', () => {
  let controller: WorkoutsController;
  let workoutRepo: jest.Mocked<IWorkoutRepository>;
  let dashboardRepo: jest.Mocked<ICycleDashboardRepository>;
  let specRepo: jest.Mocked<ILiftingProgramSpecRepository>;
  let overrideRepo: jest.Mocked<IWorkoutDateOverrideRepository>;
  let liftOverrideRepo: jest.Mocked<IWorkoutLiftOverrideRepository>;
  let factory: jest.Mocked<IRepositoryFactory>;

  beforeEach(async () => {
    workoutRepo = { getWorkout: jest.fn(), saveWorkout: jest.fn() };
    dashboardRepo = {
      getCycleDashboard: jest.fn(),
      saveCycleDashboard: jest.fn(),
    };
    specRepo = { getProgramSpec: jest.fn() };
    overrideRepo = {
      getOverride: jest.fn().mockResolvedValue(null),
      upsertOverride: jest.fn().mockResolvedValue(undefined),
    };
    liftOverrideRepo = {
      getOverrides: jest.fn().mockResolvedValue([]),
      upsertOverride: jest.fn().mockResolvedValue(undefined),
      deleteOverride: jest.fn().mockResolvedValue(undefined),
    };
    factory = {
      forUser: jest.fn().mockResolvedValue({
        workout: workoutRepo,
        cycleDashboard: dashboardRepo,
        liftingProgramSpec: specRepo,
        workoutDateOverride: overrideRepo,
        workoutLiftOverride: liftOverrideRepo,
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkoutsController],
      providers: [{ provide: REPOSITORY_FACTORY, useValue: factory }],
    }).compile();
    controller = module.get(WorkoutsController);
  });

  it('groups records by lift, sources week from spec, and looks up current cycle', async () => {
    dashboardRepo.getCycleDashboard.mockResolvedValue({
      program: '5-3-1',
      cycleUnit: 'week',
      cycleNum: 3,
      cycleDate: new Date('2026-04-20T00:00:00.000Z'),
      sheetName: '',
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training' as const,
    });
    specRepo.getProgramSpec.mockResolvedValue([
      {
        week: 1,
        offset: 0,
        lift: 'Squat',
        increment: 5,
        order: 1,
        sets: 3,
        reps: 5,
        amrap: true,
        warmUpPct: '0.4,0.5,0.6',
        wtDecrementPct: 0.1,
        activation: 'compound',
      },
    ]);
    workoutRepo.getWorkout.mockResolvedValue([
      {
        program: '5-3-1',
        cycleNum: 3,
        workoutNum: 1,
        date: new Date('2026-04-20T00:00:00.000Z'),
        lift: 'Squat',
        setNum: 1,
        weight: 200,
        reps: 5,
        notes: '',
      },
      {
        program: '5-3-1',
        cycleNum: 3,
        workoutNum: 1,
        date: new Date('2026-04-20T00:00:00.000Z'),
        lift: 'Squat',
        setNum: 2,
        weight: 220,
        reps: 5,
        notes: 'AMRAP',
      },
    ]);

    const result = await controller.getWorkout('5-3-1', '1', MOCK_USER);

    expect(workoutRepo.getWorkout).toHaveBeenCalledWith('5-3-1', 3, 1);
    expect(result.cycleNum).toBe(3);
    expect(result.week).toBe(1);
    expect(result.lifts).toHaveLength(1);
    expect(result.lifts[0]?.lift).toBe('Squat');
    expect(result.lifts[0]?.planned).toBe(false);
    expect(result.lifts[0]?.sets).toEqual([
      { setNum: 1, weight: 200, reps: 5, amrap: false },
      { setNum: 2, weight: 220, reps: 5, amrap: true },
    ]);
  });

  it('throws BadRequestException when workoutNum exceeds spec offset count', async () => {
    specRepo.getProgramSpec.mockResolvedValue([
      {
        offset: 0,
        lift: 'Squat',
        increment: 5,
        order: 1,
        sets: 3,
        reps: 5,
        amrap: true,
        warmUpPct: '0.4,0.5,0.6',
        wtDecrementPct: 0.1,
        activation: 'compound',
      },
    ]);
    dashboardRepo.getCycleDashboard.mockResolvedValue({
      program: '5-3-1',
      cycleUnit: 'week',
      cycleNum: 3,
      cycleDate: new Date('2026-04-20T00:00:00.000Z'),
      sheetName: '',
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training' as const,
    });
    workoutRepo.getWorkout.mockResolvedValue([]);

    await expect(controller.getWorkout('5-3-1', '2', MOCK_USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects non-numeric workoutNum', async () => {
    await expect(controller.getWorkout('5-3-1', 'abc', MOCK_USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects workoutNum that exceeds the number of offset groups in the spec', async () => {
    dashboardRepo.getCycleDashboard.mockResolvedValue({
      program: '5-3-1',
      cycleUnit: 'week',
      cycleNum: 3,
      cycleDate: new Date('2026-04-20T00:00:00.000Z'),
      sheetName: '',
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training' as const,
    });
    specRepo.getProgramSpec.mockResolvedValue([
      {
        week: 1,
        offset: 0,
        lift: 'Squat',
        increment: 5,
        order: 1,
        sets: 3,
        reps: 5,
        amrap: true,
        warmUpPct: '0.4,0.5,0.6',
        wtDecrementPct: 0.1,
        activation: 'compound',
      },
    ]);

    await expect(controller.getWorkout('5-3-1', '2', MOCK_USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  describe('overrideDate', () => {
    const baseDashboard = {
      program: '5-3-1',
      cycleUnit: 'week',
      cycleNum: 3,
      cycleDate: new Date('2026-04-20T00:00:00.000Z'),
      sheetName: '',
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training' as const,
    };
    const baseSpec = [
      {
        week: 1,
        offset: 0,
        lift: 'Squat',
        increment: 5,
        order: 1,
        sets: 3,
        reps: 5,
        amrap: false,
        warmUpPct: '',
        wtDecrementPct: 0,
        activation: 'compound',
      },
    ];
    const baseRecord = {
      program: '5-3-1',
      cycleNum: 3,
      workoutNum: 1,
      date: new Date('2026-04-20T00:00:00.000Z'),
      lift: 'Squat',
      setNum: 1,
      weight: 200,
      reps: 5,
      notes: '',
    };

    it('includes overrideDate in response when an override exists', async () => {
      dashboardRepo.getCycleDashboard.mockResolvedValue(baseDashboard);
      specRepo.getProgramSpec.mockResolvedValue(baseSpec);
      workoutRepo.getWorkout.mockResolvedValue([baseRecord]);
      overrideRepo.getOverride.mockResolvedValue(new Date('2026-05-01T00:00:00.000Z'));

      const result = await controller.getWorkout('5-3-1', '1', MOCK_USER);

      expect(result.overrideDate).toBe('2026-05-01');
    });

    it('omits overrideDate when no override exists', async () => {
      dashboardRepo.getCycleDashboard.mockResolvedValue(baseDashboard);
      specRepo.getProgramSpec.mockResolvedValue(baseSpec);
      workoutRepo.getWorkout.mockResolvedValue([baseRecord]);
      overrideRepo.getOverride.mockResolvedValue(null);

      const result = await controller.getWorkout('5-3-1', '1', MOCK_USER);

      expect(result.overrideDate).toBeUndefined();
    });
  });

  describe('upcoming workouts (no logged records)', () => {
    const dashboard = {
      program: '5-3-1',
      cycleUnit: 'week',
      cycleNum: 3,
      cycleDate: new Date('2026-04-20T00:00:00.000Z'),
      sheetName: '',
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training' as const,
    };
    const twoLiftSpec = [
      { week: 1, offset: 0, lift: 'Squat', increment: 5, order: 1, sets: 3, reps: 5, amrap: false, warmUpPct: '', wtDecrementPct: 0, activation: 'compound' },
      { week: 1, offset: 0, lift: 'Bench Press', increment: 5, order: 2, sets: 3, reps: 5, amrap: false, warmUpPct: '', wtDecrementPct: 0, activation: 'compound' },
    ];

    it('returns planned lifts with planned:true and empty sets when workout not yet logged', async () => {
      dashboardRepo.getCycleDashboard.mockResolvedValue(dashboard);
      specRepo.getProgramSpec.mockResolvedValue(twoLiftSpec);
      workoutRepo.getWorkout.mockRejectedValue(new WorkoutNotFoundError('5-3-1', 3, 1));

      const result = await controller.getWorkout('5-3-1', '1', MOCK_USER);

      expect(result.lifts).toHaveLength(2);
      expect(result.lifts[0]).toMatchObject({ lift: 'Squat', sets: [], planned: true });
      expect(result.lifts[1]).toMatchObject({ lift: 'Bench Press', sets: [], planned: true });
    });

    it('excludes removed lifts from the planned list', async () => {
      dashboardRepo.getCycleDashboard.mockResolvedValue(dashboard);
      specRepo.getProgramSpec.mockResolvedValue(twoLiftSpec);
      workoutRepo.getWorkout.mockRejectedValue(new WorkoutNotFoundError('5-3-1', 3, 1));
      liftOverrideRepo.getOverrides.mockResolvedValue([{ lift: 'Squat', action: 'remove' }]);

      const result = await controller.getWorkout('5-3-1', '1', MOCK_USER);

      expect(result.lifts.map((l) => l.lift)).toEqual(['Bench Press']);
    });

    it('appends added lifts to the planned list', async () => {
      dashboardRepo.getCycleDashboard.mockResolvedValue(dashboard);
      specRepo.getProgramSpec.mockResolvedValue(twoLiftSpec);
      workoutRepo.getWorkout.mockRejectedValue(new WorkoutNotFoundError('5-3-1', 3, 1));
      liftOverrideRepo.getOverrides.mockResolvedValue([{ lift: 'Deadlift', action: 'add' }]);

      const result = await controller.getWorkout('5-3-1', '1', MOCK_USER);

      expect(result.lifts.map((l) => l.lift)).toEqual(['Squat', 'Bench Press', 'Deadlift']);
    });

    it('rethrows non-WorkoutNotFoundError errors', async () => {
      dashboardRepo.getCycleDashboard.mockResolvedValue(dashboard);
      specRepo.getProgramSpec.mockResolvedValue(twoLiftSpec);
      workoutRepo.getWorkout.mockRejectedValue(new Error('db connection lost'));

      await expect(controller.getWorkout('5-3-1', '1', MOCK_USER)).rejects.toThrow('db connection lost');
    });
  });
});
