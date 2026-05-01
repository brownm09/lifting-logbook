import { Test, TestingModule } from '@nestjs/testing';
import { InMemoryBodyWeightRepository } from '../adapters/in-memory/body-weight.adapter';
import { InMemoryCycleDashboardRepository } from '../adapters/in-memory/cycle-dashboard.adapter';
import { InMemoryLiftRecordRepository } from '../adapters/in-memory/lift-record.adapter';
import { InMemoryLiftingProgramSpecRepository } from '../adapters/in-memory/lifting-program-spec.adapter';
import { InMemoryProgramPhilosophyRepository } from '../adapters/in-memory/program-philosophy.adapter';
import { InMemoryTrainingMaxRepository } from '../adapters/in-memory/training-max.adapter';
import { InMemoryWorkoutRepository } from '../adapters/in-memory/workout.adapter';
import {
  BODY_WEIGHT_REPOSITORY,
  CYCLE_DASHBOARD_REPOSITORY,
  CYCLE_PLANNING_AGENT,
  LIFT_RECORD_REPOSITORY,
  LIFTING_PROGRAM_SPEC_REPOSITORY,
  PROGRAM_PHILOSOPHY_REPOSITORY,
  TRAINING_MAX_REPOSITORY,
  WORKOUT_REPOSITORY,
} from '../ports/tokens';
import { ICyclePlanningAgent } from '../ports/ICyclePlanningAgent';
import { CyclePlanController } from './cycle-plan.controller';

describe('CyclePlanController', () => {
  let controller: CyclePlanController;
  let agent: jest.Mocked<ICyclePlanningAgent>;

  beforeEach(async () => {
    agent = { plan: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CyclePlanController],
      providers: [
        { provide: CYCLE_PLANNING_AGENT, useValue: agent },
        { provide: BODY_WEIGHT_REPOSITORY, useClass: InMemoryBodyWeightRepository },
        {
          provide: CYCLE_DASHBOARD_REPOSITORY,
          useClass: InMemoryCycleDashboardRepository,
        },
        { provide: WORKOUT_REPOSITORY, useClass: InMemoryWorkoutRepository },
        { provide: TRAINING_MAX_REPOSITORY, useClass: InMemoryTrainingMaxRepository },
        { provide: LIFT_RECORD_REPOSITORY, useClass: InMemoryLiftRecordRepository },
        {
          provide: LIFTING_PROGRAM_SPEC_REPOSITORY,
          useClass: InMemoryLiftingProgramSpecRepository,
        },
        {
          provide: PROGRAM_PHILOSOPHY_REPOSITORY,
          useClass: InMemoryProgramPhilosophyRepository,
        },
      ],
    }).compile();

    controller = module.get(CyclePlanController);
  });

  it('returns the agent result mapped to CyclePlanResponse', async () => {
    agent.plan.mockResolvedValue({
      proposedChanges: [
        {
          lift: 'Squat',
          currentWeight: 315,
          proposedWeight: 325,
          reasoning: 'Hit 7 reps on AMRAP at 95% — TM is light.',
        },
      ],
      overallReasoning: 'Bumping Squat; holding others.',
      partial: false,
    });

    const result = await controller.plan({
      program: '5-3-1',
      goal: 'peak my squat',
      cycleNum: 2,
    });

    expect(agent.plan).toHaveBeenCalledTimes(1);
    const [repos, request] = agent.plan.mock.calls[0]!;
    expect(request).toEqual({ program: '5-3-1', goal: 'peak my squat', cycleNum: 2 });
    expect(repos.cycleDashboard).toBeDefined();
    expect(repos.programPhilosophy).toBeDefined();
    expect(result).toEqual({
      proposedChanges: [
        {
          lift: 'Squat',
          currentWeight: 315,
          proposedWeight: 325,
          reasoning: 'Hit 7 reps on AMRAP at 95% — TM is light.',
        },
      ],
      overallReasoning: 'Bumping Squat; holding others.',
      partial: false,
    });
  });

  it('passes through partial:true and partialReason when the agent times out', async () => {
    agent.plan.mockResolvedValue({
      proposedChanges: [],
      overallReasoning: 'Agent exceeded the deadline before producing a plan.',
      partial: true,
      partialReason: 'deadline',
    });

    const result = await controller.plan({
      program: '5-3-1',
      goal: 'lean out',
      cycleNum: 3,
    });

    expect(result.partial).toBe(true);
    expect(result.partialReason).toBe('deadline');
    expect(result.proposedChanges).toEqual([]);
  });

  it('passes through partial:true with partialReason:budget when budget exhausted', async () => {
    agent.plan.mockResolvedValue({
      proposedChanges: [],
      overallReasoning: 'Agent exhausted tool-call budget without proposing a plan.',
      partial: true,
      partialReason: 'budget',
    });

    const result = await controller.plan({
      program: '5-3-1',
      goal: 'add 50 lbs to squat',
      cycleNum: 5,
    });

    expect(result.partial).toBe(true);
    expect(result.partialReason).toBe('budget');
  });
});
