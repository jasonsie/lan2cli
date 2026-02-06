import { GoogleGenerativeAI } from '@google/generative-ai';
import { IncomingMessage } from 'http';
import { Readable } from 'stream';
import { CompletionOptions, CompletionProvider } from './types';
import { KnownError } from '../error';
import { commandName } from '../constants';

export class GeminiProvider implements CompletionProvider {
  validateConfig(options: CompletionOptions): void {
    if (!options.apiKey) {
      throw new KnownError(
        `Please set your Gemini API key via '${commandName} config set GEMINI_KEY=<your token>'
`
      );
    }
  }

  async generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage> {
    this.validateConfig(options);

    const genAI = new GoogleGenerativeAI(options.apiKey!);
    const model = genAI.getGenerativeModel({
      model: options.model || 'gemini-3-flash-preview',
    });

    const result = await model.generateContentStream(prompt);

    let started = false;
    const readable = new Readable({
      async read() {
        if (started) return;
        started = true;

        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();

            const payload = {
              choices: [
                {
                  delta: {
                    content: text,
                  },
                },
              ],
            };
            this.push(`data: ${JSON.stringify(payload)}

`);
          }
          this.push('data: [DONE]\n\n');
          this.push(null);
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });

    return readable as unknown as IncomingMessage;
  }
}
