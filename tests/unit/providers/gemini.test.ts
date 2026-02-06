import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../../../src/helpers/providers/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Readable } from 'stream';

// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai');

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  const mockGetGenerativeModel = vi.fn();
  const mockGenerateContentStream = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new GeminiProvider();

    mockGetGenerativeModel.mockReturnValue({
      generateContentStream: mockGenerateContentStream,
    });

    vi.mocked(GoogleGenerativeAI).mockImplementation(
      () =>
        ({
          getGenerativeModel: mockGetGenerativeModel,
        } as any)
    );
  });

  it('should validate config correctly', () => {
    expect(() => provider.validateConfig({})).toThrow(
      /Please set your Gemini API key/
    );
    expect(() => provider.validateConfig({ apiKey: 'test-key' })).not.toThrow();
  });

  it('should generate completion and stream data in SSE format', async () => {
    // Mock stream response
    const mockStream = {
      stream: (async function* () {
        yield { text: () => 'Hello' };
        yield { text: () => ' World' };
      })(),
    };
    mockGenerateContentStream.mockResolvedValue(mockStream);

    const stream = await provider.generateCompletion('test prompt', {
      apiKey: 'test-key',
      model: 'gemini-pro',
    });

    expect(stream).toBeInstanceOf(Readable);

    // Collect data from stream
    const chunks: string[] = [];
    for await (const chunk of stream as Readable) {
      chunks.push(chunk.toString());
    }

    const fullData = chunks.join('');

    // Check for SSE format
    expect(fullData).toContain(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
    );
    expect(fullData).toContain(
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n'
    );
    expect(fullData).toContain('data: [DONE]\n\n');
  });

  it('should use default model if not specified', async () => {
    // Mock stream response
    const mockStream = {
      stream: (async function* () {
        yield { text: () => '' };
      })(),
    };
    mockGenerateContentStream.mockResolvedValue(mockStream);

    await provider.generateCompletion('test', { apiKey: 'key' });

    // Verify default model 'gemini-3-flash-preview' was used
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-3-flash-preview',
    });
  });
});
