import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import {
  AnthropicProvider,
  supportsEffort,
  supportsFallbacks,
} from '../../../src/helpers/providers/anthropic';
import { KnownError } from '../../../src/helpers/error';

// Keep the SDK's real error classes (needed for instanceof checks) and replace
// only the client constructor.
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  const MockAnthropic: any = vi.fn();
  // The error classes are inherited statics, so for...in (not own names).
  for (const name in actual.default) {
    if (/Error$/.test(name))
      MockAnthropic[name] = (actual.default as any)[name];
  }
  return { ...actual, default: MockAnthropic };
});

const textDelta = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'text_delta', text },
});
const thinkingDelta = (thinking: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'thinking_delta', thinking },
});
const signatureDelta = () => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'signature_delta', signature: 'sig' },
});

const endTurn = { stop_reason: 'end_turn', stop_details: null };

function makeStream(
  events: unknown[],
  finalMessage: unknown = endTurn,
  failWith?: unknown
) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
      if (failWith) throw failWith;
    },
    finalMessage: vi.fn().mockResolvedValue(finalMessage),
  };
}

async function collect(stream: unknown): Promise<string> {
  let out = '';
  for await (const chunk of stream as Readable) out += chunk.toString();
  return out;
}

const sse = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  const mockStream = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    provider = new AnthropicProvider();
    vi.mocked(Anthropic).mockImplementation(
      () => ({ beta: { messages: { stream: mockStream } } } as any)
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('validateConfig', () => {
    it('throws a helpful KnownError without a key or env var', () => {
      expect(() => provider.validateConfig({})).toThrow(KnownError);
      expect(() => provider.validateConfig({})).toThrow(
        /config set ANTHROPIC_KEY=.*ANTHROPIC_API_KEY/
      );
    });

    it('accepts a configured key', () => {
      expect(() => provider.validateConfig({ apiKey: 'k' })).not.toThrow();
    });

    it('accepts the ANTHROPIC_API_KEY environment variable', () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'env-key');
      expect(() => provider.validateConfig({})).not.toThrow();
    });
  });

  describe('streaming', () => {
    it('emits text deltas as OpenAI-style SSE chunks followed by [DONE]', async () => {
      mockStream.mockReturnValue(
        makeStream([textDelta('echo'), textDelta(' hi')])
      );

      const stream = await provider.generateCompletion('say hi', {
        apiKey: 'k',
      });

      expect(stream).toBeInstanceOf(Readable);
      expect(await collect(stream)).toBe(
        sse('echo') + sse(' hi') + 'data: [DONE]\n\n'
      );
    });

    it('ignores thinking, signature and non-delta events', async () => {
      mockStream.mockReturnValue(
        makeStream([
          { type: 'message_start' },
          thinkingDelta('hmm'),
          signatureDelta(),
          textDelta('ls'),
          thinkingDelta('more'),
          textDelta(' -la'),
          { type: 'message_stop' },
        ])
      );

      const out = await collect(
        await provider.generateCompletion('list', { apiKey: 'k' })
      );

      expect(out).toBe(sse('ls') + sse(' -la') + 'data: [DONE]\n\n');
      expect(out).not.toContain('hmm');
      expect(out).not.toContain('sig');
    });

    it('finishes with only [DONE] when the model returns no text', async () => {
      mockStream.mockReturnValue(makeStream([thinkingDelta('...')]));

      const out = await collect(
        await provider.generateCompletion('x', { apiKey: 'k' })
      );

      expect(out).toBe('data: [DONE]\n\n');
    });
  });

  describe('request parameters', () => {
    it('sends the Opus 5.5 defaults with effort and refusal fallbacks', async () => {
      mockStream.mockReturnValue(makeStream([textDelta('x')]));

      await provider.generateCompletion('my prompt', { apiKey: 'k' });

      expect(mockStream).toHaveBeenCalledWith({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        messages: [{ role: 'user', content: 'my prompt' }],
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    });

    it('never sends sampling, thinking, system or prefill parameters', async () => {
      mockStream.mockReturnValue(makeStream([textDelta('x')]));

      await provider.generateCompletion('p', { apiKey: 'k' });

      const params = mockStream.mock.calls[0][0];
      for (const key of ['temperature', 'top_p', 'top_k', 'thinking']) {
        expect(params).not.toHaveProperty(key);
      }
      expect(params.messages).toHaveLength(1);
      expect(params.messages[0].role).toBe('user');
    });

    it('uses the configured model', async () => {
      mockStream.mockReturnValue(makeStream([textDelta('x')]));

      await provider.generateCompletion('p', {
        apiKey: 'k',
        model: 'claude-sonnet-5-5',
      });

      expect(mockStream.mock.calls[0][0].model).toBe('claude-sonnet-5-5');
    });

    it('omits fallbacks for Haiku, which rejects them, but keeps effort', async () => {
      mockStream.mockReturnValue(makeStream([textDelta('x')]));

      await provider.generateCompletion('p', {
        apiKey: 'k',
        model: 'claude-haiku-5-5',
      });

      const params = mockStream.mock.calls[0][0];
      expect(params).not.toHaveProperty('fallbacks');
      expect(params).not.toHaveProperty('betas');
      expect(params.output_config).toEqual({ effort: 'low' });
    });

    it('omits effort and fallbacks for older models', async () => {
      mockStream.mockReturnValue(makeStream([textDelta('x')]));

      await provider.generateCompletion('p', {
        apiKey: 'k',
        model: 'claude-3-5-haiku-latest',
      });

      const params = mockStream.mock.calls[0][0];
      expect(params).not.toHaveProperty('output_config');
      expect(params).not.toHaveProperty('fallbacks');
    });

    it('passes the configured key to the client', async () => {
      mockStream.mockReturnValue(makeStream([textDelta('x')]));

      await provider.generateCompletion('p', { apiKey: 'cfg-key' });

      expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'cfg-key' });
    });

    it('leaves key resolution to the SDK when only the env var is set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'env-key');
      mockStream.mockReturnValue(makeStream([textDelta('x')]));

      await provider.generateCompletion('p', {});

      expect(Anthropic).toHaveBeenCalledWith({});
    });
  });

  describe('model capability checks', () => {
    it.each([
      ['claude-opus-5-5', true, true],
      ['claude-sonnet-5-5', true, true],
      ['claude-haiku-5-5', true, false],
      ['claude-opus-4-8', false, false],
      ['claude-3-5-haiku-latest', false, false],
    ])('%s: effort=%s fallbacks=%s', (model, effort, fallbacks) => {
      expect(supportsEffort(model)).toBe(effort);
      expect(supportsFallbacks(model)).toBe(fallbacks);
    });
  });

  describe('refusals', () => {
    const refusal = {
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'cyber', explanation: null },
    };

    it('throws a KnownError with the category when refused before any text', async () => {
      mockStream.mockReturnValue(makeStream([], refusal));

      const call = provider.generateCompletion('p', { apiKey: 'k' });

      await expect(call).rejects.toBeInstanceOf(KnownError);
      await expect(call).rejects.toThrow(/declined.*category: cyber/);
    });

    it('omits the category when none is given', async () => {
      mockStream.mockReturnValue(
        makeStream([], { stop_reason: 'refusal', stop_details: null })
      );

      await expect(
        provider.generateCompletion('p', { apiKey: 'k' })
      ).rejects.toThrow(/^Claude declined this request\. /);
    });

    it('errors the stream when the refusal arrives after some text', async () => {
      mockStream.mockReturnValue(makeStream([textDelta('rm')], refusal));

      const stream = await provider.generateCompletion('p', { apiKey: 'k' });

      await expect(collect(stream)).rejects.toThrow(/category: cyber/);
    });
  });

  describe('error mapping', () => {
    const headers = new Headers();

    const cases: [string, unknown, RegExp][] = [
      [
        'AuthenticationError',
        new Anthropic.AuthenticationError(401, {}, 'bad key', headers),
        /rejected your API key.*ANTHROPIC_KEY/,
      ],
      [
        'PermissionDeniedError',
        new Anthropic.PermissionDeniedError(403, {}, 'nope', headers),
        /does not have permission/,
      ],
      [
        'NotFoundError',
        new Anthropic.NotFoundError(404, {}, 'no such model', headers),
        /could not find the requested model.*MODEL/,
      ],
      [
        'BadRequestError',
        new Anthropic.BadRequestError(
          400,
          { error: { message: 'invalid field' } },
          undefined,
          headers
        ),
        /rejected the request \(400\): invalid field/,
      ],
      [
        'RateLimitError',
        new Anthropic.RateLimitError(429, {}, 'slow down', headers),
        /rate limit/,
      ],
      [
        'InternalServerError',
        new Anthropic.InternalServerError(529, {}, 'overloaded', headers),
        /unavailable or overloaded \(529\)/,
      ],
      [
        'APIConnectionError',
        new Anthropic.APIConnectionError({ message: 'down' }),
        /Could not reach the Anthropic API/,
      ],
      [
        'APIConnectionTimeoutError',
        new Anthropic.APIConnectionTimeoutError(),
        /Could not reach the Anthropic API/,
      ],
      [
        'APIError',
        new Anthropic.APIError(
          418,
          { error: { message: 'teapot' } },
          undefined,
          headers
        ),
        /failed with status 418: teapot/,
      ],
    ];

    it.each(cases)('maps %s to a KnownError', async (_name, error, pattern) => {
      mockStream.mockReturnValue(makeStream([], endTurn, error));

      const call = provider.generateCompletion('p', { apiKey: 'k' });

      await expect(call).rejects.toBeInstanceOf(KnownError);
      await expect(call).rejects.toThrow(pattern);
    });

    it('does not claim a bad key for a rate limit', async () => {
      mockStream.mockReturnValue(
        makeStream(
          [],
          endTurn,
          new Anthropic.RateLimitError(429, {}, 'API key', headers)
        )
      );

      await expect(
        provider.generateCompletion('p', { apiKey: 'k' })
      ).rejects.not.toThrow(/API key/);
    });

    it('maps errors that occur after streaming has started', async () => {
      mockStream.mockReturnValue(
        makeStream(
          [textDelta('ls')],
          endTurn,
          new Anthropic.APIConnectionError({ message: 'dropped' })
        )
      );

      const stream = await provider.generateCompletion('p', { apiKey: 'k' });

      await expect(collect(stream)).rejects.toBeInstanceOf(KnownError);
    });

    it('passes unknown errors through unchanged', async () => {
      const boom = new Error('boom');
      mockStream.mockReturnValue(makeStream([], endTurn, boom));

      await expect(
        provider.generateCompletion('p', { apiKey: 'k' })
      ).rejects.toBe(boom);
    });
  });
});
