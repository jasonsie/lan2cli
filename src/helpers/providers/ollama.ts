import { IncomingMessage } from 'http';
import { Readable } from 'stream';
import axios, { AxiosError } from 'axios';
import { CompletionOptions, CompletionProvider } from './types';
import { KnownError } from '../error';

const OLLAMA_TIMEOUT_MS = 10000; // 10 seconds
const DEFAULT_MODEL = 'qwen2.5-coder:14b';
const DEFAULT_HOST = 'http://localhost:11434';

/**
 * Handle Ollama-specific errors and convert to user-friendly messages
 */
function handleOllamaError(error: unknown, host: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    // Connection refused - Ollama not running
    if (axiosError.code === 'ECONNREFUSED') {
      throw new KnownError(
        `${'Cannot connect to Ollama at'} ${host}. ${'Please ensure Ollama is running'} (ollama serve).`
      );
    }

    // Connection timeout
    if (
      axiosError.code === 'ECONNABORTED' ||
      axiosError.code === 'ETIMEDOUT' ||
      axiosError.message?.includes('timeout')
    ) {
      throw new KnownError(
        `${'Connection to Ollama timed out after'} ${
          OLLAMA_TIMEOUT_MS / 1000
        }s. ${'Please check if Ollama is responding'}.`
      );
    }

    // Network unreachable
    if (
      axiosError.code === 'ENETUNREACH' ||
      axiosError.code === 'EHOSTUNREACH'
    ) {
      throw new KnownError(
        `${'Cannot reach Ollama at'} ${host}. ${'Please check your network connection'}.`
      );
    }

    // HTTP error responses
    if (axiosError.response) {
      const status = axiosError.response.status;
      if (status === 404) {
        throw new KnownError(
          `${'Ollama endpoint not found at'} ${host}. ${'Please verify the host URL'}.`
        );
      }
      throw new KnownError(`${'Ollama request failed'}: ${axiosError.message}`);
    }
  }

  // Re-throw unknown errors
  if (error instanceof Error) {
    throw new KnownError(`${'Ollama error'}: ${error.message}`);
  }
  throw error;
}

export class OllamaProvider implements CompletionProvider {
  validateConfig(options: CompletionOptions): void {
    // Ollama doesn't strictly require API keys or complex config.
    // Host is usually localhost:11434 but can be configured.
    // Validation is handled by config.ts isValidOllamaHost function.
  }

  async generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage> {
    const host = options.endpoint || DEFAULT_HOST;
    const model = options.model || DEFAULT_MODEL;

    // Check if model exists before making the main request
    await this.checkModelAvailability(host, model);

    try {
      const response = await axios.post(
        `${host}/api/chat`,
        {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        },
        {
          responseType: 'stream',
          timeout: OLLAMA_TIMEOUT_MS,
        }
      );

      return this.convertStreamToSSE(response.data);
    } catch (error) {
      handleOllamaError(error, host);
    }
  }

  /**
   * Check if the requested model is available locally
   */
  private async checkModelAvailability(
    host: string,
    model: string
  ): Promise<void> {
    try {
      const tagsResponse = await axios.get(`${host}/api/tags`, {
        timeout: OLLAMA_TIMEOUT_MS,
      });
      const models = tagsResponse.data?.models || [];
      const modelExists = models.some(
        (m: { name: string }) =>
          m.name === model || m.name === `${model}:latest`
      );

      if (!modelExists) {
        console.warn(
          `\n${'Warning'}: ${'Model'} '${model}' ${'not found locally'}. ` +
            `${'Run'}: ollama pull ${model}\n`
        );
      }
    } catch (error) {
      // Log warning but don't fail - let the main request handle connection issues
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.code === 'ECONNREFUSED') {
          // Don't warn here, the main request will throw a proper error
          return;
        }
      }
      console.warn(
        `\n${'Warning'}: ${'Could not verify model availability at'} ${host}.\n`
      );
    }
  }

  /**
   * Convert Ollama's ndjson stream to OpenAI-compatible SSE format
   */
  private convertStreamToSSE(stream: NodeJS.ReadableStream): IncomingMessage {
    let started = false;

    const readable = new Readable({
      async read() {
        if (started) return;
        started = true;

        try {
          for await (const chunk of stream) {
            const lines = chunk
              .toString()
              .split('\n')
              .filter((l: string) => l.trim() !== '');
            for (const line of lines) {
              try {
                const json = JSON.parse(line);

                // Handle Ollama streaming error format
                if (json.error) {
                  console.error(`\n${'Ollama error'}: ${json.error}\n`);
                  this.push(null);
                  return;
                }

                // Ollama response format: { model, created_at, message: { role, content }, done }
                if (json.done) {
                  this.push('data: [DONE]\n\n');
                } else {
                  const content = json.message?.content || '';
                  // Handle empty content gracefully
                  if (content !== undefined) {
                    const payload = {
                      choices: [
                        {
                          delta: {
                            content: content,
                          },
                        },
                      ],
                    };
                    this.push(`data: ${JSON.stringify(payload)}\n\n`);
                  }
                }
              } catch {
                // Ignore parse errors for partial chunks
              }
            }
          }
          this.push(null);
        } catch (error) {
          // Handle stream interruption gracefully
          console.error(
            `\n${'Stream interrupted'}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }\n`
          );
          this.push(null);
        }
      },
    });

    return readable as unknown as IncomingMessage;
  }
}
