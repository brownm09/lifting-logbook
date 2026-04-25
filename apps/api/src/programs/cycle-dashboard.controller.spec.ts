import { Test, TestingModule } from '@nestjs/testing';
import { Weekday } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { CYCLE_DASHBOARD_REPOSITORY } from '../ports/tokens';
import { CycleDashboardController } from './cycle-dashboard.controller';

describe('CycleDashboardController', () => {
  let controller: CycleDashboardController;
  let repo: jest.Mocked<ICycleDashboardRepository>;

  beforeEach(async () => {
    repo = {
      getCycleDashboard: jest.fn(),
      saveCycleDashboard: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CycleDashboardController],
      providers: [{ provide: CYCLE_DASHBOARD_REPOSITORY, useValue: repo }],
    }).compile();
    controller = module.get(CycleDashboardController);
  });

  it('GET /programs/:program/cycles/current returns mapped dashboard', async () => {
    repo.getCycleDashboard.mockResolvedValue({
      program: '5-3-1',
      cycleUnit: 'week',
      cycleNum: 2,
      cycleDate: new Date('2026-04-20T00:00:00.000Z'),
      sheetName: '',
      cycleStartWeekday: Weekday.Monday,
    });

    const result = await controller.getCurrentCycle('5-3-1');

    expect(repo.getCycleDashboard).toHaveBeenCalledWith('5-3-1');
    expect(result).toEqual({
      program: '5-3-1',
      cycleNum: 2,
      cycleStartDate: '2026-04-20',
      weeks: [],
    });
  });
});
