import OpenAI from 'openai';
import { IncomingMessage } from 'http';
import { Readable } from 'stream';
import { CompletionOptions, CompletionProvider } from './types';
import { KnownError } from '../error';
import { commandName } from '../constants';
import dedent from 'dedent';

export class OpenAIProvider implements CompletionProvider {
  validateConfig(options: CompletionOptions): void {
    if (!options.apiKey) {
      throw new KnownError(
        `Please set your OpenAI API key via '${commandName} config set OPENAI_KEY=<your token>'`
      );
    }
  }

  async generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage> {
    this.validateConfig(options);

    const openai = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.endpoint,
    });

    try {
      const completion = await openai.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      return this.convertStreamToSSE(completion);
    } catch (err: any) {
      const error = err;

      if (error.code === 'ENOTFOUND') {
        throw new KnownError(
          `Error connecting to ${error.request?.hostname} (${error.request?.syscall}). Are you connected to the internet?`
        );
      }

      const response = error.response;
      let message = response?.data;

      const messageString = message && JSON.stringify(message, null, 2);

      if (response?.status === 429) {
        throw new KnownError(
          dedent`
            Request to OpenAI failed with status 429. This is due to incorrect billing setup or excessive quota usage. Please follow this guide to fix it: https://help.openai.com/en/articles/6891831-error-code-429-you-exceeded-your-current-quota-please-check-your-plan-and-billing-details

            You can activate billing here: https://platform.openai.com/account/billing/overview . Make sure to add a payment method if not under an active grant from OpenAI.

            Full message from OpenAI:
          ` +
            '\n\n' +
            messageString +
            '\n'
        );
      } else if (response) {
        throw new KnownError(
          dedent`
                Request to OpenAI failed with status ${response?.status}:
              ` +
            '\n\n' +
            messageString +
            '\n'
        );
      }

      throw error;
    }
  }

  /**
   * Convert OpenAI stream to IncomingMessage format for compatibility
   */
  private convertStreamToSSE(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  ): IncomingMessage {
    let started = false;

    const readable = new Readable({
      async read() {
        if (started) return;
        started = true;

        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              this.push(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: delta } }],
                })}\n\n`
              );
            }
          }
          this.push(null);
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });

    return readable as unknown as IncomingMessage;
  }
}
