import { Test, TestingModule } from '@nestjs/testing';
import { Weekday } from '@lifting-logbook/core';
import {
  ICycleDashboardRepository,
  ILiftRecordRepository,
  ILiftingProgramSpecRepository,
  ITrainingMaxRepository,
  CYCLE_DASHBOARD_REPOSITORY,
  LIFT_RECORD_REPOSITORY,
  LIFTING_PROGRAM_SPEC_REPOSITORY,
  TRAINING_MAX_REPOSITORY,
} from '../ports';
import { CycleGenerationService } from './cycle-generation.service';

const PROGRAM = '5-3-1';

const stubDashboard = () => ({
  program: PROGRAM,
  cycleUnit: 'week' as const,
  cycleNum: 1,
  cycleDate: new Date('2026-04-20T00:00:00.000Z'),
  sheetName: '',
  cycleStartWeekday: Weekday.Monday,
});

const stubProgramSpec = () => [
  {
    lift: 'Squat',
    order: 1,
    offset: 0,
    increment: 5,
    sets: 3,
    reps: 5,
    amrap: true,
    warmUpPct: '0.4,0.5,0.6',
    wtDecrementPct: 0.1,
    activation: 'compound',
  },
];

const stubTrainingMaxes = () => [
  {
    lift: 'Squat',
    weight: 315,
    dateUpdated: new Date('2026-04-18T00:00:00.000Z'),
  },
];

const stubLiftRecords = () => [
  {
    program: PROGRAM,
    cycleNum: 1,
    workoutNum: 1,
    date: new Date('2026-04-20T00:00:00.000Z'),
    lift: 'Squat',
    setNum: 1,
    weight: 265,
    reps: 5,
    notes: '',
  },
];

describe('CycleGenerationService', () => {
  let service: CycleGenerationService;
  let cycleDashboardRepo: jest.Mocked<ICycleDashboardRepository>;
  let programSpecRepo: jest.Mocked<ILiftingProgramSpecRepository>;
  let trainingMaxRepo: jest.Mocked<ITrainingMaxRepository>;
  let liftRecordRepo: jest.Mocked<ILiftRecordRepository>;

  beforeEach(async () => {
    cycleDashboardRepo = {
      getCycleDashboard: jest.fn(),
      saveCycleDashboard: jest.fn().mockResolvedValue(undefined),
    };
    programSpecRepo = {
      getProgramSpec: jest.fn(),
    };
    trainingMaxRepo = {
      getTrainingMaxes: jest.fn(),
      saveTrainingMaxes: jest.fn().mockResolvedValue(undefined),
    };
    liftRecordRepo = {
      getLiftRecords: jest.fn(),
      appendLiftRecords: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CycleGenerationService,
        { provide: CYCLE_DASHBOARD_REPOSITORY, useValue: cycleDashboardRepo },
        {
          provide: LIFTING_PROGRAM_SPEC_REPOSITORY,
          useValue: programSpecRepo,
        },
        { provide: TRAINING_MAX_REPOSITORY, useValue: trainingMaxRepo },
        { provide: LIFT_RECORD_REPOSITORY, useValue: liftRecordRepo },
      ],
    }).compile();

    service = module.get(CycleGenerationService);
  });

  describe('startNewCycle', () => {
    it('fetches current state, runs updateCycle + updateMaxes, and persists both', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue(stubLiftRecords());

      const result = await service.startNewCycle(PROGRAM);

      // Cycle number must advance by 1
      expect(result.cycleNum).toBe(2);
      expect(result.program).toBe(PROGRAM);

      // Dashboard saved with the new cycle
      expect(cycleDashboardRepo.saveCycleDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ cycleNum: 2 }),
      );

      // Training maxes saved — Squat record has reps >= spec and date after current max
      expect(trainingMaxRepo.saveTrainingMaxes).toHaveBeenCalledWith(
        PROGRAM,
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 270 }), // 265 + 5 increment
        ]),
      );
    });

    it('fetches lift records for the current cycle number', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue([]);

      await service.startNewCycle(PROGRAM);

      expect(liftRecordRepo.getLiftRecords).toHaveBeenCalledWith(PROGRAM, 1);
    });

    it('propagates ProgramNotFoundError from getCycleDashboard', async () => {
      cycleDashboardRepo.getCycleDashboard.mockRejectedValue(
        new Error('Program not found'),
      );

      await expect(service.startNewCycle('unknown')).rejects.toThrow(
        'Program not found',
      );
    });
  });

  describe('recalculateMaxes', () => {
    it('re-runs updateMaxes against current cycle records and persists', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue(stubLiftRecords());

      const result = await service.recalculateMaxes(PROGRAM);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 270 }),
        ]),
      );
      expect(trainingMaxRepo.saveTrainingMaxes).toHaveBeenCalledWith(
        PROGRAM,
        result,
      );
    });

    it('does not call saveCycleDashboard', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue([]);

      await service.recalculateMaxes(PROGRAM);

      expect(cycleDashboardRepo.saveCycleDashboard).not.toHaveBeenCalled();
    });

    it('returns unchanged maxes when there are no lift records', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue([]);

      const result = await service.recalculateMaxes(PROGRAM);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 315 }),
        ]),
      );
    });
  });
});
