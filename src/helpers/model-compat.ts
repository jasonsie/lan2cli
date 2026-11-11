import { unsetModelPlaceholder } from './constants';
import { ProviderName } from './providers/types';

const providerLabels: Record<ProviderName, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Claude',
  ollama: 'Ollama',
};

const isOpenAIModel = (model: string) =>
  model.startsWith('gpt-') || model.startsWith('text-');
const isGeminiModel = (model: string) => model.startsWith('gemini-');
const isClaudeModel = (model: string) => model.startsWith('claude-');

function isCompatible(provider: ProviderName, model: string): boolean {
  switch (provider) {
    case 'anthropic':
      // Positive check: anything that is not a claude-* name is wrong here.
      return isClaudeModel(model);
    case 'gemini':
      return !isOpenAIModel(model) && !isClaudeModel(model);
    case 'openai':
      return !isGeminiModel(model) && !isClaudeModel(model);
    default:
      // Ollama serves arbitrary local model names.
      return true;
  }
}

/**
 * Drops a configured MODEL that clearly belongs to another provider so the
 * provider falls back to its own default. A warning is returned unless the
 * value is just the MODEL parser's placeholder for "not set".
 */
export function resolveModel(
  provider: ProviderName,
  model?: string
): { model?: string; warning?: string } {
  if (!model || isCompatible(provider, model)) return { model };

  if (model === unsetModelPlaceholder) return { model: undefined };

  return {
    model: undefined,
    warning: `Warning: Model '${model}' seems incompatible with ${providerLabels[provider]}. Using default.`,
  };
}
