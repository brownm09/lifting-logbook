import { Test, TestingModule } from '@nestjs/testing';
import { Weekday } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { CYCLE_DASHBOARD_REPOSITORY, LIFTING_PROGRAM_SPEC_REPOSITORY } from '../ports/tokens';
import { CycleDashboardController } from './cycle-dashboard.controller';

const stubDashboard = (overrides: Partial<{ currentWeekType: 'training' | 'test' | 'deload' }> = {}) => ({
  program: '5-3-1',
  cycleUnit: 'week' as const,
  cycleNum: 2,
  cycleDate: new Date('2026-04-20T00:00:00.000Z'),
  sheetName: '',
  cycleStartWeekday: Weekday.Monday,
  currentWeekType: 'training' as const,
  ...overrides,
});

const stubSpec = (weekType: 'training' | 'test' | 'deload' = 'training') => [{
  week: 1,
  offset: 0,
  lift: 'Squat' as const,
  increment: 5,
  order: 1,
  sets: 3,
  reps: 5,
  amrap: false,
  warmUpPct: '40,50,60',
  wtDecrementPct: 0,
  activation: 'None',
  weekType,
}];

describe('CycleDashboardController', () => {
  let controller: CycleDashboardController;
  let repo: jest.Mocked<ICycleDashboardRepository>;
  let specRepo: jest.Mocked<ILiftingProgramSpecRepository>;

  beforeEach(async () => {
    repo = {
      getCycleDashboard: jest.fn(),
      saveCycleDashboard: jest.fn(),
    };
    specRepo = { getProgramSpec: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CycleDashboardController],
      providers: [
        { provide: CYCLE_DASHBOARD_REPOSITORY, useValue: repo },
        { provide: LIFTING_PROGRAM_SPEC_REPOSITORY, useValue: specRepo },
      ],
    }).compile();
    controller = module.get(CycleDashboardController);
  });

  it('GET /programs/:program/cycles/current returns mapped dashboard with derived weekType', async () => {
    repo.getCycleDashboard.mockResolvedValue(stubDashboard());
    specRepo.getProgramSpec.mockResolvedValue(stubSpec('training'));

    const result = await controller.getCurrentCycle('5-3-1');

    expect(repo.getCycleDashboard).toHaveBeenCalledWith('5-3-1');
    expect(specRepo.getProgramSpec).toHaveBeenCalledWith('5-3-1');
    expect(result).toEqual({
      program: '5-3-1',
      cycleNum: 2,
      cycleStartDate: '2026-04-20',
      weeks: [],
      currentWeekType: 'training',
    });
  });

  it('reflects test weekType when program spec contains a test week', async () => {
    // Cycle started 0 days ago → week 1
    repo.getCycleDashboard.mockResolvedValue(stubDashboard());
    specRepo.getProgramSpec.mockResolvedValue(stubSpec('test'));

    const result = await controller.getCurrentCycle('5-3-1');

    expect(result.currentWeekType).toBe('test');
  });
});
