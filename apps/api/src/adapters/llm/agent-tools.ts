import { RepositoryBundle } from '../../ports/factory';
import { CyclePlanRequest, CyclePlanResult } from '../../ports/ICyclePlanningAgent';

export const SYSTEM_PROMPT = `You are a strength training coach planning the next cycle for a lifter.

You have tools to read the lifter's current training maxes, recent lift records,
program specification, cycle dashboard, and program philosophy. Use the tools to
gather what you need, then call the propose_cycle_plan tool to deliver your plan.

Be conservative and follow the program's own progression rules unless the lifter's
recent performance clearly indicates otherwise. When proposing changes, justify each
one in plain English referencing actual rep counts, weights, or AMRAP performance.

Always end the conversation by calling propose_cycle_plan exactly once.`;

export function buildUserMessage(req: CyclePlanRequest): string {
  return `Plan cycle ${req.cycleNum} for program "${req.program}".\n\nLifter's goal: ${req.goal}`;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  repos: RepositoryBundle,
  request: CyclePlanRequest,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_lift_history': {
        const cycleNum =
          typeof args.cycleNum === 'number' ? args.cycleNum : request.cycleNum - 1;
        const records = await repos.liftRecord.getLiftRecords(
          request.program,
          cycleNum,
        );
        return { ok: true, data: records };
      }
      case 'get_training_maxes': {
        const maxes = await repos.trainingMax.getTrainingMaxes(request.program);
        return { ok: true, data: maxes };
      }
      case 'get_program_spec': {
        const spec = await repos.liftingProgramSpec.getProgramSpec(request.program);
        return { ok: true, data: spec };
      }
      case 'get_cycle_dashboard': {
        const dash = await repos.cycleDashboard.getCycleDashboard(request.program);
        return { ok: true, data: dash };
      }
      case 'get_program_philosophy': {
        const programType =
          typeof args.programType === 'string' ? args.programType : '';
        if (!programType) {
          return { ok: false, error: 'programType is required' };
        }
        const philosophy =
          await repos.programPhilosophy.getProgramPhilosophy(programType);
        if (!philosophy) {
          return { ok: false, error: `No philosophy for "${programType}"` };
        }
        return { ok: true, data: philosophy };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isProposeTool(name: string): boolean {
  return name === 'propose_cycle_plan';
}

export function parseProposal(args: Record<string, unknown>): CyclePlanResult {
  const proposedChanges = Array.isArray(args.proposedChanges)
    ? (args.proposedChanges as CyclePlanResult['proposedChanges'])
    : [];
  const overallReasoning =
    typeof args.overallReasoning === 'string' ? args.overallReasoning : '';
  return { proposedChanges, overallReasoning, partial: false };
}

export const MAX_TOOL_ROUNDS = 5;
export const DEADLINE_MS = 30_000;
