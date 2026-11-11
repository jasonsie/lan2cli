import Anthropic from '@anthropic-ai/sdk';
import type { APIError } from '@anthropic-ai/sdk';
import { IncomingMessage } from 'http';
import { Readable } from 'stream';
import { CompletionOptions, CompletionProvider } from './types';
import { KnownError } from '../error';
import { commandName } from '../constants';

export const DEFAULT_MODEL = 'claude-opus-5-5';

// Thinking tokens count toward max_tokens, so leave generous headroom.
const MAX_TOKENS = 16000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// Effort control and server-side refusal fallbacks exist only on the newer
// model generations. Older and Haiku models reject the fallbacks parameter
// with a 400, so both are gated on the model name.
const EFFORT_MODELS = /^claude-(opus|sonnet|haiku|fable|mythos)-5(-|$)/;
const FALLBACK_MODELS = /^claude-(opus|sonnet|fable|mythos)-5(-|$)/;

export const supportsEffort = (model: string): boolean =>
  EFFORT_MODELS.test(model);

export const supportsFallbacks = (model: string): boolean =>
  FALLBACK_MODELS.test(model);

const hasEnvCredentials = (): boolean =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const missingKeyMessage = () =>
  `Please set your Anthropic API key via '${commandName} config set ANTHROPIC_KEY=<your token>' or the ANTHROPIC_API_KEY environment variable`;

// apiMessage is the human-readable text from the response body; message also
// carries the status prefix and raw JSON.
const detail = (err: APIError): string => err.apiMessage ?? err.message;

/**
 * Map SDK errors to KnownError using the typed classes, most specific first.
 * Unknown errors are returned unchanged.
 */
export function toKnownError(err: unknown): unknown {
  if (err instanceof KnownError) return err;

  if (err instanceof Anthropic.AuthenticationError) {
    return new KnownError(
      `Anthropic rejected your API key (401). ${missingKeyMessage()}.`
    );
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new KnownError(
      `Your Anthropic API key does not have permission to use this model (403): ${detail(
        err
      )}`
    );
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new KnownError(
      `Anthropic could not find the requested model (404). Check the MODEL setting (e.g. ${DEFAULT_MODEL}): ${detail(
        err
      )}`
    );
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new KnownError(
      `Anthropic rejected the request (400): ${detail(err)}`
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new KnownError(
      'Anthropic rate limit or quota exceeded (429). Wait a moment and retry, or check your plan and billing.'
    );
  }
  if (err instanceof Anthropic.InternalServerError) {
    return new KnownError(
      `The Anthropic API is unavailable or overloaded (${err.status}). Please retry shortly.`
    );
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new KnownError(
      'Could not reach the Anthropic API. Are you connected to the internet?'
    );
  }
  if (err instanceof Anthropic.APIError) {
    return new KnownError(
      `Request to Anthropic failed with status ${err.status}: ${detail(err)}`
    );
  }
  return err;
}

function buildParams(prompt: string, model: string) {
  // No temperature/top_p/top_k (400 on current API versions), no thinking
  // param (always on for Opus 5.5), no assistant prefill.
  return {
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user' as const, content: prompt }],
    ...(supportsEffort(model) && {
      output_config: { effort: 'low' as const },
    }),
    ...(supportsFallbacks(model) && {
      betas: [FALLBACK_BETA],
      fallbacks: 'default' as const,
    }),
  };
}

type MessageStream = ReturnType<Anthropic['beta']['messages']['stream']>;

/** Advance the iterator to the next text delta; undefined when it ends. */
async function nextText(
  events: AsyncIterator<
    Anthropic.Beta.Messages.BetaRawMessageStreamEvent,
    unknown
  >
): Promise<string | undefined> {
  for (;;) {
    const { done, value } = await events.next();
    if (done) return undefined;
    if (
      value.type === 'content_block_delta' &&
      value.delta.type === 'text_delta'
    ) {
      return value.delta.text;
    }
  }
}

async function assertNotRefused(stream: MessageStream): Promise<void> {
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    const category = message.stop_details?.category;
    throw new KnownError(
      `Claude declined this request${
        category ? ` (category: ${category})` : ''
      }. Try rephrasing the prompt.`
    );
  }
}

export class AnthropicProvider implements CompletionProvider {
  validateConfig(options: CompletionOptions): void {
    if (!options.apiKey && !hasEnvCredentials()) {
      throw new KnownError(`${missingKeyMessage()}.`);
    }
  }

  async generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage> {
    this.validateConfig(options);

    // Without an explicit key the SDK resolves ANTHROPIC_API_KEY itself.
    const client = new Anthropic(
      options.apiKey ? { apiKey: options.apiKey } : {}
    );

    try {
      const stream = client.beta.messages.stream(
        buildParams(prompt, options.model || DEFAULT_MODEL)
      );
      const events = stream[Symbol.asyncIterator]();

      // The SDK reports request errors (auth, rate limit, bad model) while
      // iterating, so read up to the first text delta here to surface them
      // as KnownErrors before the caller starts consuming the stream.
      const first = await nextText(events);
      if (first === undefined) await assertNotRefused(stream);

      return this.convertStreamToSSE(stream, events, first);
    } catch (err) {
      throw toKnownError(err);
    }
  }

  /**
   * Convert Claude text deltas to the OpenAI-style SSE chunks the CLI reads.
   * Thinking and signature deltas are skipped by nextText.
   */
  private convertStreamToSSE(
    stream: MessageStream,
    events: AsyncIterator<
      Anthropic.Beta.Messages.BetaRawMessageStreamEvent,
      unknown
    >,
    first: string | undefined
  ): IncomingMessage {
    let started = false;

    const readable = new Readable({
      async read() {
        if (started) return;
        started = true;

        try {
          for (
            let text = first;
            text !== undefined;
            text = await nextText(events)
          ) {
            this.push(
              `data: ${JSON.stringify({
                choices: [{ delta: { content: text } }],
              })}\n\n`
            );
          }
          await assertNotRefused(stream);
          this.push('data: [DONE]\n\n');
          this.push(null);
        } catch (error) {
          this.destroy(toKnownError(error) as Error);
        }
      },
    });

    return readable as unknown as IncomingMessage;
  }
}
