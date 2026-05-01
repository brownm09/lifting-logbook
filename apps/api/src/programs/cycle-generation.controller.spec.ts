import { Test, TestingModule } from '@nestjs/testing';
import { Weekday } from '@lifting-logbook/core';
import { CycleGenerationController } from './cycle-generation.controller';
import { CycleGenerationService } from './cycle-generation.service';

const PROGRAM = '5-3-1';

const stubCycleDashboard = () => ({
  program: PROGRAM,
  cycleUnit: 'week' as const,
  cycleNum: 2,
  cycleDate: new Date('2026-04-27T00:00:00.000Z'),
  sheetName: '5-3-1_Cycle_2_20260427',
  cycleStartWeekday: Weekday.Monday,
  currentWeekType: 'training' as const,
});

describe('CycleGenerationController', () => {
  let controller: CycleGenerationController;
  let service: jest.Mocked<Pick<CycleGenerationService, 'startNewCycle' | 'recalculateMaxes'>>;

  beforeEach(async () => {
    service = {
      startNewCycle: jest.fn(),
      recalculateMaxes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CycleGenerationController],
      providers: [{ provide: CycleGenerationService, useValue: service }],
    }).compile();

    controller = module.get(CycleGenerationController);
  });

  describe('startNewCycle', () => {
    it('calls service with program and dto, returns mapped response', async () => {
      service.startNewCycle.mockResolvedValue(stubCycleDashboard());

      const result = await controller.startNewCycle(PROGRAM, {});

      expect(service.startNewCycle).toHaveBeenCalledWith(PROGRAM, {});
      expect(result).toEqual({
        program: PROGRAM,
        cycleNum: 2,
        cycleStartDate: '2026-04-27',
        weeks: [],
        currentWeekType: 'training',
      });
    });

    it('passes fromCycleNum and cycleDate through to service', async () => {
      service.startNewCycle.mockResolvedValue(stubCycleDashboard());

      await controller.startNewCycle(PROGRAM, {
        fromCycleNum: 1,
        cycleDate: '2026-05-01',
      });

      expect(service.startNewCycle).toHaveBeenCalledWith(PROGRAM, {
        fromCycleNum: 1,
        cycleDate: '2026-05-01',
      });
    });

    it('propagates service errors (e.g. 404 from unknown program)', async () => {
      service.startNewCycle.mockRejectedValue(new Error('Program not found'));

      await expect(controller.startNewCycle('unknown', {})).rejects.toThrow(
        'Program not found',
      );
    });
  });

  describe('recalculateMaxes', () => {
    it('calls service with program and returns mapped maxes', async () => {
      service.recalculateMaxes.mockResolvedValue([
        {
          lift: 'Squat',
          weight: 270,
          dateUpdated: new Date('2026-04-27T00:00:00.000Z'),
        },
      ]);

      const result = await controller.recalculateMaxes(PROGRAM);

      expect(service.recalculateMaxes).toHaveBeenCalledWith(PROGRAM);
      expect(result).toEqual([
        { lift: 'Squat', weight: 270, unit: 'lbs', dateUpdated: '2026-04-27' },
      ]);
    });
  });
});
