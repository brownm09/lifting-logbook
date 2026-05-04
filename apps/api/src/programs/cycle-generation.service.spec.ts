import { BadRequestException } from '@nestjs/common';
import { Weekday } from '@lifting-logbook/core';
import {
  ICycleDashboardRepository,
  ILiftRecordRepository,
  ILiftingProgramSpecRepository,
  ITrainingMaxRepository,
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
  currentWeekType: 'training' as const,
});

const stubProgramSpec = () => [
  {
    week: 1,
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
    weight: 250,
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
  let repos: {
    cycleDashboard: jest.Mocked<ICycleDashboardRepository>;
    liftingProgramSpec: jest.Mocked<ILiftingProgramSpecRepository>;
    trainingMax: jest.Mocked<ITrainingMaxRepository>;
    liftRecord: jest.Mocked<ILiftRecordRepository>;
  };

  beforeEach(() => {
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
    repos = {
      cycleDashboard: cycleDashboardRepo,
      liftingProgramSpec: programSpecRepo,
      trainingMax: trainingMaxRepo,
      liftRecord: liftRecordRepo,
    };
    service = new CycleGenerationService();
  });

  describe('startNewCycle', () => {
    it('fetches current state, runs updateCycle + updateMaxes, and persists both', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue(stubLiftRecords());

      const result = await service.startNewCycle(repos, PROGRAM);

      expect(result.cycleNum).toBe(2);
      expect(result.program).toBe(PROGRAM);

      expect(cycleDashboardRepo.saveCycleDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ cycleNum: 2 }),
      );

      expect(trainingMaxRepo.saveTrainingMaxes).toHaveBeenCalledWith(
        PROGRAM,
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 270 }),
        ]),
      );
    });

    it('fetches lift records for the current cycle number', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue([]);

      await service.startNewCycle(repos, PROGRAM);

      expect(liftRecordRepo.getLiftRecords).toHaveBeenCalledWith(PROGRAM, 1);
    });

    it('propagates ProgramNotFoundError from getCycleDashboard', async () => {
      cycleDashboardRepo.getCycleDashboard.mockRejectedValue(
        new Error('Program not found'),
      );

      await expect(service.startNewCycle(repos, 'unknown')).rejects.toThrow(
        'Program not found',
      );
    });

    it('fetches records for fromCycleNum when provided and advances from that cycle', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue(stubLiftRecords());

      const result = await service.startNewCycle(repos, PROGRAM, { fromCycleNum: 3 });

      expect(liftRecordRepo.getLiftRecords).toHaveBeenCalledWith(PROGRAM, 3);
      expect(result.cycleNum).toBe(4);
    });

    it('throws BadRequestException when fromCycleNum has no records', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue([]);

      await expect(
        service.startNewCycle(repos, PROGRAM, { fromCycleNum: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('pins cycleDate when cycleDate override is provided', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue(stubLiftRecords());

      const result = await service.startNewCycle(repos, PROGRAM, { cycleDate: '2026-06-01' });

      expect(result.cycleDate).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    });
  });

  describe('recalculateMaxes', () => {
    it('re-runs updateMaxes against current cycle records and persists', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue(stubLiftRecords());

      const result = await service.recalculateMaxes(repos, PROGRAM);

      expect(result.maxes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 270 }),
        ]),
      );
      expect(result.flagged).toEqual([]);
      expect(trainingMaxRepo.saveTrainingMaxes).toHaveBeenCalledWith(PROGRAM, result.maxes);
    });

    it('does not call saveCycleDashboard', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue([]);

      await service.recalculateMaxes(repos, PROGRAM);

      expect(cycleDashboardRepo.saveCycleDashboard).not.toHaveBeenCalled();
    });

    it('returns unchanged maxes when there are no lift records', async () => {
      cycleDashboardRepo.getCycleDashboard.mockResolvedValue(stubDashboard());
      programSpecRepo.getProgramSpec.mockResolvedValue(stubProgramSpec());
      trainingMaxRepo.getTrainingMaxes.mockResolvedValue(stubTrainingMaxes());
      liftRecordRepo.getLiftRecords.mockResolvedValue([]);

      const result = await service.recalculateMaxes(repos, PROGRAM);

      expect(result.maxes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ lift: 'Squat', weight: 250 }),
        ]),
      );
    });
  });
});
