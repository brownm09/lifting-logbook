import { Test, TestingModule } from '@nestjs/testing';
import { IRepositoryFactory, RepositoryBundle } from '../ports/factory';
import { ICyclePlanningAgent, WithRlsContext } from '../ports/ICyclePlanningAgent';
import { CYCLE_PLANNING_AGENT, REPOSITORY_FACTORY } from '../ports/tokens';
import { RlsContextService } from '../adapters/prisma/rls-context.service';
import { CyclePlanController } from './cycle-plan.controller';

const MOCK_USER = { id: 'test-user', email: 'test@example.com', provider: 'dev' };
const MOCK_BUNDLE = {} as RepositoryBundle;

describe('CyclePlanController', () => {
  let controller: CyclePlanController;
  let agent: jest.Mocked<ICyclePlanningAgent>;
  let factory: jest.Mocked<IRepositoryFactory>;
  // Passthrough RlsContextService stub: runs the callback directly (in-memory mode behaviour),
  // so the controller's withContext resolves repos via factory.forUser and forwards them.
  const rlsContext = {
    withUserContext: jest.fn((fn: () => Promise<unknown>) => fn()),
  };

  beforeEach(async () => {
    agent = { plan: jest.fn() };
    factory = {
      forUser: jest.fn().mockResolvedValue(MOCK_BUNDLE),
    };
    rlsContext.withUserContext.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CyclePlanController],
      providers: [
        { provide: CYCLE_PLANNING_AGENT, useValue: agent },
        { provide: REPOSITORY_FACTORY, useValue: factory },
        { provide: RlsContextService, useValue: rlsContext },
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
    }, MOCK_USER);

    expect(agent.plan).toHaveBeenCalledTimes(1);
    const [request, withContext] = agent.plan.mock.calls[0]!;
    expect(request).toEqual({ program: '5-3-1', goal: 'peak my squat', cycleNum: 2 });

    // withContext must resolve the per-user repository bundle inside the RLS context and pass it
    // to the callback. forUser is only called when the agent actually invokes withContext.
    expect(factory.forUser).not.toHaveBeenCalled();
    const received = await (withContext as WithRlsContext)((repos) => Promise.resolve(repos));
    expect(rlsContext.withUserContext).toHaveBeenCalledTimes(1);
    expect(factory.forUser).toHaveBeenCalledWith(MOCK_USER);
    expect(received).toBe(MOCK_BUNDLE);

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
    }, MOCK_USER);

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
    }, MOCK_USER);

    expect(result.partial).toBe(true);
    expect(result.partialReason).toBe('budget');
  });
});
