import { Test, TestingModule } from '@nestjs/testing';
import { Weekday } from '@lifting-logbook/core';
import { IRepositoryFactory, RepositoryBundle } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { CycleGenerationController } from './cycle-generation.controller';
import { CycleGenerationService } from './cycle-generation.service';

const MOCK_USER = { id: 'test-user', email: 'test@example.com', provider: 'dev' };

const PROGRAM = '5-3-1';

const stubProgramSpec = () => [{
  week: 1,
  offset: 0,
  lift: 'Squat',
  increment: 5,
  order: 1,
  sets: 3,
  reps: 5,
  amrap: false,
  warmUpPct: '40,50,60',
  wtDecrementPct: 0,
  activation: 'None',
  weekType: 'training' as const,
}];

const MOCK_BUNDLE = {} as RepositoryBundle;

const stubCycleDashboard = () => ({
  program: PROGRAM,
  cycleUnit: 'week' as const,
  cycleNum: 2,
  cycleDate: new Date('2026-04-27T00:00:00.000Z'),
  sheetName: '5-3-1_Cycle_2_20260427',
  cycleStartWeekday: Weekday.Monday,
});

describe('CycleGenerationController', () => {
  let controller: CycleGenerationController;
  let service: jest.Mocked<Pick<CycleGenerationService, 'startNewCycle' | 'recalculateMaxes' | 'initializeFirstCycle'>>;
  let factory: jest.Mocked<IRepositoryFactory>;

  beforeEach(async () => {
    service = {
      startNewCycle: jest.fn(),
      recalculateMaxes: jest.fn(),
      initializeFirstCycle: jest.fn(),
    };
    factory = {
      forUser: jest.fn().mockResolvedValue(MOCK_BUNDLE),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CycleGenerationController],
      providers: [
        { provide: CycleGenerationService, useValue: service },
        { provide: REPOSITORY_FACTORY, useValue: factory },
      ],
    }).compile();

    controller = module.get(CycleGenerationController);
  });

  describe('startNewCycle', () => {
    it('calls service with repos, program, and dto, returns mapped response', async () => {
      service.startNewCycle.mockResolvedValue({ dashboard: stubCycleDashboard(), programSpec: stubProgramSpec() });

      const result = await controller.startNewCycle(PROGRAM, {}, MOCK_USER);

      expect(factory.forUser).toHaveBeenCalledWith(MOCK_USER);
      expect(service.startNewCycle).toHaveBeenCalledWith(MOCK_BUNDLE, PROGRAM, {});
      expect(result).toEqual({
        program: PROGRAM,
        cycleNum: 2,
        cycleStartDate: '2026-04-27',
        weeks: [],
        currentWeekType: 'training',
      });
    });

    it('passes fromCycleNum and cycleDate through to service', async () => {
      service.startNewCycle.mockResolvedValue({ dashboard: stubCycleDashboard(), programSpec: stubProgramSpec() });

      await controller.startNewCycle(PROGRAM, {
        fromCycleNum: 1,
        cycleDate: '2026-05-01',
      }, MOCK_USER);

      expect(service.startNewCycle).toHaveBeenCalledWith(MOCK_BUNDLE, PROGRAM, {
        fromCycleNum: 1,
        cycleDate: '2026-05-01',
      });
    });

    it('propagates service errors (e.g. 404 from unknown program)', async () => {
      service.startNewCycle.mockRejectedValue(new Error('Program not found'));

      await expect(controller.startNewCycle('unknown', {}, MOCK_USER)).rejects.toThrow(
        'Program not found',
      );
    });
  });

  describe('initializeFirstCycle', () => {
    const stubInitDashboard = () => ({
      program: PROGRAM,
      cycleUnit: 'week' as const,
      cycleNum: 1,
      cycleDate: new Date('2026-05-12T00:00:00.000Z'),
      sheetName: '5-3-1_Cycle_1_20260512',
      cycleStartWeekday: Weekday.Monday,
      programType: '5-3-1',
    });

    it('calls service with repos, program, and dto, returns mapped response', async () => {
      service.initializeFirstCycle.mockResolvedValue({ dashboard: stubInitDashboard(), programSpec: stubProgramSpec() });

      const result = await controller.initializeFirstCycle(PROGRAM, {}, MOCK_USER);

      expect(factory.forUser).toHaveBeenCalledWith(MOCK_USER);
      expect(service.initializeFirstCycle).toHaveBeenCalledWith(MOCK_BUNDLE, PROGRAM, {});
      expect(result).toEqual({
        program: PROGRAM,
        cycleNum: 1,
        cycleStartDate: '2026-05-12',
        weeks: [],
        currentWeekType: 'training',
      });
    });

    it('passes optional cycleDate through to service', async () => {
      service.initializeFirstCycle.mockResolvedValue({ dashboard: stubInitDashboard(), programSpec: stubProgramSpec() });

      await controller.initializeFirstCycle(PROGRAM, { cycleDate: '2026-05-12' }, MOCK_USER);

      expect(service.initializeFirstCycle).toHaveBeenCalledWith(
        MOCK_BUNDLE,
        PROGRAM,
        { cycleDate: '2026-05-12' },
      );
    });

    it('propagates service errors (e.g. ConflictException)', async () => {
      service.initializeFirstCycle.mockRejectedValue(new Error('Already exists'));

      await expect(
        controller.initializeFirstCycle(PROGRAM, {}, MOCK_USER),
      ).rejects.toThrow('Already exists');
    });
  });

  describe('recalculateMaxes', () => {
    it('calls service with repos and program, returns mapped maxes and flagged', async () => {
      service.recalculateMaxes.mockResolvedValue({
        maxes: [
          {
            lift: 'Squat',
            weight: 270,
            dateUpdated: new Date('2026-04-27T00:00:00.000Z'),
          },
        ],
        flagged: [],
      });

      const result = await controller.recalculateMaxes(PROGRAM, MOCK_USER);

      expect(factory.forUser).toHaveBeenCalledWith(MOCK_USER);
      expect(service.recalculateMaxes).toHaveBeenCalledWith(MOCK_BUNDLE, PROGRAM);
      expect(result).toEqual({
        maxes: [{ lift: 'Squat', weight: 270, unit: 'lbs', dateUpdated: '2026-04-27' }],
        flagged: [],
      });
    });
  });
});
