import { Logger, Provider } from '@nestjs/common';
import { CYCLE_PLANNING_AGENT } from '../../ports/tokens';
import { ICyclePlanningAgent } from '../../ports/ICyclePlanningAgent';
import { AnthropicCyclePlanningAdapter } from './anthropic-cycle-planning.adapter';
import { OpenAICompatibleCyclePlanningAdapter } from './openai-compatible-cycle-planning.adapter';

const logger = new Logger('CyclePlanningProviderFactory');

export function buildCyclePlanningAgent(): ICyclePlanningAgent {
  const provider = (process.env.CYCLE_AGENT_PROVIDER ?? 'openai').toLowerCase();
  if (provider === 'anthropic') {
    logger.log('Using Anthropic cycle planning adapter');
    return new AnthropicCyclePlanningAdapter();
  }
  logger.log(`Using OpenAI-compatible cycle planning adapter (provider="${provider}")`);
  return new OpenAICompatibleCyclePlanningAdapter();
}

export const cyclePlanningAgentProvider: Provider = {
  provide: CYCLE_PLANNING_AGENT,
  useFactory: () => buildCyclePlanningAgent(),
};
