import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
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

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_lift_history',
      description:
        "Fetch the lifter's recorded sets for a given cycle. Defaults to the previous cycle if cycleNum is omitted.",
      parameters: {
        type: 'object',
        properties: {
          cycleNum: { type: 'number', description: 'The cycle number to read' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_training_maxes',
      description: 'Fetch the current training maxes for the program.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_program_spec',
      description:
        'Fetch the per-lift program specification (sets, reps, percentages, increments).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cycle_dashboard',
      description:
        'Fetch the cycle dashboard (current cycleNum, programType, schedule).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_program_philosophy',
      description:
        'Fetch curated guidance for a program type (e.g. "5-3-1", "starting-strength"). Use programType from the cycle dashboard.',
      parameters: {
        type: 'object',
        properties: {
          programType: { type: 'string' },
        },
        required: ['programType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_cycle_plan',
      description:
        'Terminal tool. Submit the final cycle plan with proposed training-max changes and overall reasoning.',
      parameters: {
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
  },
];

@Injectable()
export class OpenAICompatibleCyclePlanningAdapter implements ICyclePlanningAgent {
  private readonly logger = new Logger(OpenAICompatibleCyclePlanningAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const baseURL = process.env.CYCLE_AGENT_BASE_URL ?? 'http://localhost:11434/v1';
    const apiKey = process.env.CYCLE_AGENT_API_KEY ?? 'ollama';
    this.model = process.env.CYCLE_AGENT_MODEL ?? 'llama3.1';
    this.client = new OpenAI({ baseURL, apiKey });
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
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(request) },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 4096,
      });
      const choice = completion.choices[0];
      if (!choice) {
        return {
          proposedChanges: [],
          overallReasoning: 'Agent returned no choices.',
          partial: true,
        };
      }
      const msg = choice.message;
      messages.push(msg);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return {
          proposedChanges: [],
          overallReasoning: msg.content ?? 'Agent returned no plan.',
          partial: true,
        };
      }

      for (const call of toolCalls) {
        if (call.type !== 'function') continue;
        const name = call.function.name;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.function.arguments) as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        if (isProposeTool(name)) {
          return parseProposal(parsed);
        }
        const result = await dispatchTool(name, parsed, repos, request);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return {
      proposedChanges: [],
      overallReasoning: 'Agent exhausted tool-call budget without proposing a plan.',
      partial: true,
    };
  }
}
