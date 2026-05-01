import { Test, TestingModule } from '@nestjs/testing';
import { Weekday } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { ILiftRecordRepository } from '../ports/ILiftRecordRepository';
import {
  CYCLE_DASHBOARD_REPOSITORY,
  LIFT_RECORD_REPOSITORY,
} from '../ports/tokens';
import { LiftRecordsController } from './lift-records.controller';

describe('LiftRecordsController', () => {
  let controller: LiftRecordsController;
  let liftRecordRepo: jest.Mocked<ILiftRecordRepository>;
  let dashboardRepo: jest.Mocked<ICycleDashboardRepository>;

  beforeEach(async () => {
    liftRecordRepo = {
      getLiftRecords: jest.fn(),
      appendLiftRecords: jest.fn(),
    };
    dashboardRepo = {
      getCycleDashboard: jest.fn(),
      saveCycleDashboard: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LiftRecordsController],
      providers: [
        { provide: LIFT_RECORD_REPOSITORY, useValue: liftRecordRepo },
        { provide: CYCLE_DASHBOARD_REPOSITORY, useValue: dashboardRepo },
      ],
    }).compile();
    controller = module.get(LiftRecordsController);
  });

  it('fetches lift records scoped to current cycle', async () => {
    dashboardRepo.getCycleDashboard.mockResolvedValue({
      program: '5-3-1',
      cycleUnit: 'week',
      cycleNum: 4,
      cycleDate: new Date('2026-04-20T00:00:00.000Z'),
      sheetName: '',
      cycleStartWeekday: Weekday.Monday,
      currentWeekType: 'training' as const,
    });
    liftRecordRepo.getLiftRecords.mockResolvedValue([
      {
        program: '5-3-1',
        cycleNum: 4,
        workoutNum: 1,
        date: new Date('2026-04-20T00:00:00.000Z'),
        lift: 'Bench Press',
        setNum: 1,
        weight: 180,
        reps: 5,
        notes: '',
      },
    ]);

    const result = await controller.getLiftRecords('5-3-1');

    expect(liftRecordRepo.getLiftRecords).toHaveBeenCalledWith('5-3-1', 4);
    expect(result).toHaveLength(1);
    expect(result[0]?.lift).toBe('Bench Press');
    expect(result[0]?.date).toBe('2026-04-20');
  });
});
