import { CompletionProvider, ProviderName } from './types';
import { KnownError } from '../error';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';

export function createProvider(providerName: ProviderName): CompletionProvider {
  switch (providerName) {
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new KnownError(`${'Invalid provider'}: ${providerName}`);
  }
}
