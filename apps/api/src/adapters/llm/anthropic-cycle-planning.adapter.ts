import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  CyclePlanRequest,
  CyclePlanResult,
  ICyclePlanningAgent,
} from '../../ports/ICyclePlanningAgent';
import { RepositoryBundle } from '../../ports/factory';
import {
  DEADLINE_MS,
  MAX_TOOL_ROUNDS,
  SYSTEM_PROMPT,
  buildUserMessage,
  dispatchTool,
  isProposeTool,
  parseProposal,
} from './agent-tools';

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'get_lift_history',
    description:
      "Fetch the lifter's recorded sets for a given cycle. Defaults to the previous cycle if cycleNum is omitted.",
    input_schema: {
      type: 'object',
      properties: {
        cycleNum: { type: 'number' },
      },
    },
  },
  {
    name: 'get_training_maxes',
    description: 'Fetch the current training maxes for the program.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_program_spec',
    description:
      'Fetch the per-lift program specification (sets, reps, percentages, increments).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cycle_dashboard',
    description:
      'Fetch the cycle dashboard (current cycleNum, programType, schedule).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_program_philosophy',
    description:
      'Fetch curated guidance for a program type (e.g. "5-3-1", "starting-strength"). Use programType from the cycle dashboard.',
    input_schema: {
      type: 'object',
      properties: { programType: { type: 'string' } },
      required: ['programType'],
    },
  },
  {
    name: 'propose_cycle_plan',
    description:
      'Terminal tool. Submit the final cycle plan with proposed training-max changes and overall reasoning.',
    input_schema: {
      type: 'object',
      properties: {
        proposedChanges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lift: { type: 'string' },
              currentWeight: { type: 'number' },
              proposedWeight: { type: 'number' },
              reasoning: { type: 'string' },
            },
            required: ['lift', 'currentWeight', 'proposedWeight', 'reasoning'],
          },
        },
        overallReasoning: { type: 'string' },
      },
      required: ['proposedChanges', 'overallReasoning'],
    },
  },
];

@Injectable()
export class AnthropicCyclePlanningAdapter implements ICyclePlanningAgent {
  private readonly logger = new Logger(AnthropicCyclePlanningAdapter.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.CYCLE_AGENT_MODEL ?? 'claude-sonnet-4-6';
    this.client = new Anthropic({ apiKey });
  }

  async plan(
    repos: RepositoryBundle,
    request: CyclePlanRequest,
  ): Promise<CyclePlanResult> {
    const work = this.runLoop(repos, request);
    const deadline = new Promise<CyclePlanResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            proposedChanges: [],
            overallReasoning: 'Agent exceeded the deadline before producing a plan.',
            partial: true,
          }),
        DEADLINE_MS,
      ),
    );
    return Promise.race([work, deadline]);
  }

  private async runLoop(
    repos: RepositoryBundle,
    request: CyclePlanRequest,
  ): Promise<CyclePlanResult> {
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: buildUserMessage(request) },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: this.model,
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
        max_tokens: 4096,
      });

      messages.push({ role: 'assistant', content: response.content });

      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
      );

      if (toolUses.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        return {
          proposedChanges: [],
          overallReasoning: text || 'Agent returned no plan.',
          partial: true,
        };
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const args = (use.input ?? {}) as Record<string, unknown>;
        if (isProposeTool(use.name)) {
          return parseProposal(args);
        }
        const result = await dispatchTool(use.name, args, repos, request);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
          is_error: !result.ok,
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return {
      proposedChanges: [],
      overallReasoning: 'Agent exhausted tool-call budget without proposing a plan.',
      partial: true,
    };
  }
}
