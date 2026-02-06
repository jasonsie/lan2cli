import { CompletionProvider } from './types';
import { KnownError } from '../error';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';

export function createProvider(
  providerName: 'openai' | 'gemini' | 'ollama'
): CompletionProvider {
  switch (providerName) {
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new KnownError(`${'Invalid provider'}: ${providerName}`);
  }
}
