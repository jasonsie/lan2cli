import { IncomingMessage } from 'http';

export interface CompletionOptions {
  model?: string;
  apiKey?: string;
  endpoint?: string;
}

export interface CompletionProvider {
  /**
   * Generates a completion stream for the given prompt.
   * @param prompt The prompt to send to the model.
   * @param options Provider-specific options (key, model, etc).
   * @returns A stream (IncomingMessage or similar) that emits data chunks.
   */
  generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage | ReadableStream>;

  /**
   * Checks if the provider is configured correctly.
   * @param options Provider options.
   * @throws KnownError if configuration is invalid (e.g. missing key).
   */
  validateConfig(options: CompletionOptions): void;
}
