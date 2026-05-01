import { dispatchTool, isProposeTool, parseProposal } from './agent-tools';
import { RepositoryBundle } from '../../ports/factory';
import { CyclePlanRequest } from '../../ports/ICyclePlanningAgent';

const REQ: CyclePlanRequest = { program: '5-3-1', goal: 'gain', cycleNum: 3 };

const mkRepos = (): RepositoryBundle => ({
  cycleDashboard: {
    getCycleDashboard: jest.fn().mockResolvedValue({ program: '5-3-1', programType: '5-3-1' }),
    saveCycleDashboard: jest.fn(),
  },
  liftingProgramSpec: {
    getProgramSpec: jest.fn().mockResolvedValue([{ lift: 'Squat' }]),
    saveProgramSpec: jest.fn(),
  } as unknown as RepositoryBundle['liftingProgramSpec'],
  liftRecord: {
    getLiftRecords: jest.fn().mockResolvedValue([{ setNum: 1 }]),
  } as unknown as RepositoryBundle['liftRecord'],
  programPhilosophy: {
    getProgramPhilosophy: jest.fn().mockResolvedValue({
      programType: '5-3-1',
      displayName: '5/3/1',
      summary: '',
      progressionRules: '',
      trainingMaxGuidance: '',
      deloadGuidance: '',
      notes: [],
    }),
    listPrograms: jest.fn(),
  },
  trainingMax: {
    getTrainingMaxes: jest.fn().mockResolvedValue([{ lift: 'Squat', weight: 315 }]),
  } as unknown as RepositoryBundle['trainingMax'],
  workout: {} as RepositoryBundle['workout'],
});

describe('agent-tools', () => {
  describe('dispatchTool', () => {
    it('routes get_lift_history with explicit cycleNum', async () => {
      const repos = mkRepos();
      const result = await dispatchTool('get_lift_history', { cycleNum: 2 }, repos, REQ);
      expect(result.ok).toBe(true);
      expect(repos.liftRecord.getLiftRecords).toHaveBeenCalledWith('5-3-1', 2);
    });

    it('routes get_lift_history defaulting to previous cycle', async () => {
      const repos = mkRepos();
      await dispatchTool('get_lift_history', {}, repos, REQ);
      expect(repos.liftRecord.getLiftRecords).toHaveBeenCalledWith('5-3-1', 2);
    });

    it('routes get_training_maxes', async () => {
      const repos = mkRepos();
      const result = await dispatchTool('get_training_maxes', {}, repos, REQ);
      expect(result.ok).toBe(true);
      expect(repos.trainingMax.getTrainingMaxes).toHaveBeenCalledWith('5-3-1');
    });

    it('routes get_program_spec', async () => {
      const repos = mkRepos();
      await dispatchTool('get_program_spec', {}, repos, REQ);
      expect(repos.liftingProgramSpec.getProgramSpec).toHaveBeenCalledWith('5-3-1');
    });

    it('routes get_cycle_dashboard', async () => {
      const repos = mkRepos();
      await dispatchTool('get_cycle_dashboard', {}, repos, REQ);
      expect(repos.cycleDashboard.getCycleDashboard).toHaveBeenCalledWith('5-3-1');
    });

    it('routes get_program_philosophy', async () => {
      const repos = mkRepos();
      const result = await dispatchTool(
        'get_program_philosophy',
        { programType: '5-3-1' },
        repos,
        REQ,
      );
      expect(result.ok).toBe(true);
      expect(repos.programPhilosophy.getProgramPhilosophy).toHaveBeenCalledWith('5-3-1');
    });

    it('rejects get_program_philosophy without programType', async () => {
      const repos = mkRepos();
      const result = await dispatchTool('get_program_philosophy', {}, repos, REQ);
      expect(result.ok).toBe(false);
    });

    it('returns ok:false for unknown tool', async () => {
      const repos = mkRepos();
      const result = await dispatchTool('bogus', {}, repos, REQ);
      expect(result.ok).toBe(false);
    });

    it('catches repository errors and returns ok:false', async () => {
      const repos = mkRepos();
      (repos.trainingMax.getTrainingMaxes as jest.Mock).mockRejectedValue(
        new Error('boom'),
      );
      const result = await dispatchTool('get_training_maxes', {}, repos, REQ);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('boom');
    });
  });

  describe('isProposeTool', () => {
    it('matches propose_cycle_plan', () => {
      expect(isProposeTool('propose_cycle_plan')).toBe(true);
      expect(isProposeTool('get_training_maxes')).toBe(false);
    });
  });

  describe('parseProposal', () => {
    it('produces a CyclePlanResult with partial:false', () => {
      const r = parseProposal({
        proposedChanges: [
          { lift: 'Squat', currentWeight: 315, proposedWeight: 325, reasoning: 'r' },
        ],
        overallReasoning: 'ok',
      });
      expect(r.partial).toBe(false);
      expect(r.proposedChanges).toHaveLength(1);
      expect(r.overallReasoning).toBe('ok');
    });

    it('defaults missing fields safely', () => {
      const r = parseProposal({});
      expect(r.proposedChanges).toEqual([]);
      expect(r.overallReasoning).toBe('');
      expect(r.partial).toBe(false);
    });

    it('drops elements with non-numeric weight', () => {
      const r = parseProposal({
        proposedChanges: [
          { lift: 'Squat', currentWeight: 'heavy', proposedWeight: 325, reasoning: 'r' },
          { lift: 'Bench Press', currentWeight: 225, proposedWeight: 235, reasoning: 'r' },
        ],
        overallReasoning: 'ok',
      });
      expect(r.proposedChanges).toHaveLength(1);
      expect(r.proposedChanges[0]!.lift).toBe('Bench Press');
    });

    it('drops elements with zero or negative weight', () => {
      const r = parseProposal({
        proposedChanges: [
          { lift: 'Squat', currentWeight: 0, proposedWeight: 325, reasoning: 'r' },
          { lift: 'Deadlift', currentWeight: 405, proposedWeight: -10, reasoning: 'r' },
        ],
        overallReasoning: 'ok',
      });
      expect(r.proposedChanges).toHaveLength(0);
    });

    it('drops elements with empty lift name', () => {
      const r = parseProposal({
        proposedChanges: [
          { lift: '', currentWeight: 315, proposedWeight: 325, reasoning: 'r' },
        ],
        overallReasoning: 'ok',
      });
      expect(r.proposedChanges).toHaveLength(0);
    });

    it('drops elements missing required fields', () => {
      const r = parseProposal({
        proposedChanges: [
          { lift: 'Squat', currentWeight: 315 }, // missing proposedWeight and reasoning
        ],
        overallReasoning: 'ok',
      });
      expect(r.proposedChanges).toHaveLength(0);
    });
  });
});
