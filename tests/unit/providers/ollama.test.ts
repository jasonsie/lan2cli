import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../../src/helpers/providers/ollama';
import axios, { AxiosError } from 'axios';
import { Readable } from 'stream';
import {
  loadCommandGenerationFixture,
  loadErrorFixtures,
  loadStreamingChunks,
  createMockStream,
  createAxiosError,
} from '../../fixtures/ollama/loader';

vi.mock('axios');

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new OllamaProvider();
    // Mock axios.isAxiosError to check the isAxiosError property
    vi.mocked(axios.isAxiosError).mockImplementation(
      (error: unknown): error is AxiosError =>
        error !== null &&
        typeof error === 'object' &&
        (error as any).isAxiosError === true
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // Phase 3: User Story 1 - Basic Command Generation Tests
  // ============================================================

  describe('US1: Basic Command Generation', () => {
    // T011: Unit test for generateCompletion with successful streaming
    describe('generateCompletion with successful streaming', () => {
      it('should generate completion and stream data in SSE format', async () => {
        const fixture = loadCommandGenerationFixture();

        // Mock /api/tags response
        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: fixture.request.model }] },
        });

        // Create mock stream from fixture chunks
        const mockStream = createMockStream(fixture.response.chunks);

        vi.mocked(axios.post).mockResolvedValue({
          data: mockStream,
        });

        const stream = await provider.generateCompletion(
          fixture.request.prompt,
          {
            model: fixture.request.model,
            endpoint: 'http://localhost:11434',
          }
        );

        expect(stream).toBeInstanceOf(Readable);

        const chunks: string[] = [];
        for await (const chunk of stream as Readable) {
          chunks.push(chunk.toString());
        }

        const fullData = chunks.join('');
        // Verify SSE format
        expect(fullData).toContain('data: ');
        expect(fullData).toContain('data: [DONE]');
      });

      it('should call axios.post with correct parameters', async () => {
        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test-model' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: Readable.from([JSON.stringify({ done: true }) + '\n']),
        });

        await provider.generateCompletion('test prompt', {
          model: 'test-model',
          endpoint: 'http://custom:11434',
        });

        expect(axios.post).toHaveBeenCalledWith(
          'http://custom:11434/api/chat',
          {
            model: 'test-model',
            messages: [{ role: 'user', content: 'test prompt' }],
            stream: true,
          },
          {
            responseType: 'stream',
            timeout: 10000,
          }
        );
      });
    });

    // T012: Unit test for ndjson to SSE format conversion
    describe('ndjson to SSE format conversion', () => {
      it('should convert Ollama ndjson chunks to OpenAI SSE format', async () => {
        const streamingChunks = loadStreamingChunks();

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'qwen2.5-coder:14b' }] },
        });

        const mockStream = createMockStream(streamingChunks);
        vi.mocked(axios.post).mockResolvedValue({ data: mockStream });

        const stream = await provider.generateCompletion('list files', {
          model: 'qwen2.5-coder:14b',
          endpoint: 'http://localhost:11434',
        });

        const chunks: string[] = [];
        for await (const chunk of stream as Readable) {
          chunks.push(chunk.toString());
        }

        const fullData = chunks.join('');

        // Verify each content chunk is properly converted to SSE
        for (const ollamaChunk of streamingChunks) {
          if (!ollamaChunk.done && ollamaChunk.message?.content) {
            const expectedPayload = {
              choices: [{ delta: { content: ollamaChunk.message.content } }],
            };
            expect(fullData).toContain(
              `data: ${JSON.stringify(expectedPayload)}`
            );
          }
        }

        // Verify final [DONE] marker
        expect(fullData).toContain('data: [DONE]');
      });

      it('should handle multi-chunk streaming correctly', async () => {
        const chunks = [
          {
            model: 'test',
            message: { role: 'assistant' as const, content: 'Hello' },
            done: false,
          },
          {
            model: 'test',
            message: { role: 'assistant' as const, content: ' World' },
            done: false,
          },
          {
            model: 'test',
            message: { role: 'assistant' as const, content: '!' },
            done: false,
          },
          { model: 'test', done: true, done_reason: 'stop' },
        ];

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: createMockStream(chunks),
        });

        const stream = await provider.generateCompletion('test', {
          model: 'test',
          endpoint: 'http://localhost:11434',
        });

        const outputChunks: string[] = [];
        for await (const chunk of stream as Readable) {
          outputChunks.push(chunk.toString());
        }

        const fullData = outputChunks.join('');

        // All content should be present
        expect(fullData).toContain('"content":"Hello"');
        expect(fullData).toContain('"content":" World"');
        expect(fullData).toContain('"content":"!"');
        expect(fullData).toContain('data: [DONE]');
      });
    });

    // T013: Unit test for default model usage
    describe('default model (qwen2.5-coder:14b) usage', () => {
      it('should use default model when none specified', async () => {
        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'qwen2.5-coder:14b' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: Readable.from([JSON.stringify({ done: true }) + '\n']),
        });

        await provider.generateCompletion('test', {});

        // Check that default model was used
        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            model: 'qwen2.5-coder:14b',
          }),
          expect.any(Object)
        );
      });

      it('should use default host when none specified', async () => {
        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'qwen2.5-coder:14b' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: Readable.from([JSON.stringify({ done: true }) + '\n']),
        });

        await provider.generateCompletion('test', {});

        // Check that default host was used
        expect(axios.post).toHaveBeenCalledWith(
          'http://localhost:11434/api/chat',
          expect.any(Object),
          expect.any(Object)
        );
      });
    });

    // T016: Empty response handling (edge case)
    describe('empty response handling', () => {
      it('should handle empty content gracefully', async () => {
        const chunks = [
          {
            model: 'test',
            message: { role: 'assistant' as const, content: '' },
            done: false,
          },
          { model: 'test', done: true },
        ];

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: createMockStream(chunks),
        });

        const stream = await provider.generateCompletion('test', {
          model: 'test',
          endpoint: 'http://localhost:11434',
        });

        const outputChunks: string[] = [];
        for await (const chunk of stream as Readable) {
          outputChunks.push(chunk.toString());
        }

        const fullData = outputChunks.join('');
        // Should still complete successfully
        expect(fullData).toContain('data: [DONE]');
      });

      it('should handle missing message field', async () => {
        const chunks = [
          { model: 'test', done: false }, // No message field
          { model: 'test', done: true },
        ];

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: createMockStream(chunks),
        });

        const stream = await provider.generateCompletion('test', {
          model: 'test',
          endpoint: 'http://localhost:11434',
        });

        const outputChunks: string[] = [];
        for await (const chunk of stream as Readable) {
          outputChunks.push(chunk.toString());
        }

        const fullData = outputChunks.join('');
        // Should still complete successfully
        expect(fullData).toContain('data: [DONE]');
      });
    });
  });

  // ============================================================
  // Phase 4: User Story 2 - Error Handling Tests
  // ============================================================

  describe('US2: Graceful Error Handling', () => {
    // T018: Unit test for connection refused error handling
    describe('connection refused error handling', () => {
      it('should throw user-friendly error on ECONNREFUSED', async () => {
        const errorFixtures = loadErrorFixtures();
        const connError = errorFixtures.connectionRefused;

        const axiosError = new Error(connError.error.message) as AxiosError;
        (axiosError as any).code = connError.error.code;
        (axiosError as any).isAxiosError = true;

        // Model availability check catches and logs, so we need to mock it to pass
        // The real error occurs on the main POST request
        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', {
            model: 'test',
            endpoint: 'http://localhost:11434',
          })
        ).rejects.toThrow(/Cannot connect to Ollama/);
      });

      it('should include host in connection error message', async () => {
        const axiosError = createAxiosError(
          'ECONNREFUSED',
          'Connection refused'
        );

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', {
            model: 'test',
            endpoint: 'http://custom:8080',
          })
        ).rejects.toThrow(/http:\/\/custom:8080/);
      });
    });

    // T019: Unit test for timeout error handling
    describe('timeout error handling', () => {
      it('should throw user-friendly error on ETIMEDOUT', async () => {
        const errorFixtures = loadErrorFixtures();
        const timeoutError = errorFixtures.timeout;

        const axiosError = new Error(timeoutError.error.message) as AxiosError;
        (axiosError as any).code = timeoutError.error.code;
        (axiosError as any).isAxiosError = true;

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', {
            model: 'test',
            endpoint: 'http://localhost:11434',
          })
        ).rejects.toThrow(/timed out/);
      });

      it('should throw user-friendly error on ECONNABORTED', async () => {
        const axiosError = createAxiosError('ECONNABORTED', 'Request aborted');

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', { model: 'test' })
        ).rejects.toThrow(/timed out/);
      });

      it('should handle timeout in error message', async () => {
        const axiosError = new Error(
          'timeout of 10000ms exceeded'
        ) as AxiosError;
        (axiosError as any).isAxiosError = true;

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', { model: 'test' })
        ).rejects.toThrow(/timed out/);
      });
    });

    // T020: Unit test for model not found warning
    describe('model not found warning', () => {
      it('should warn if model is not found locally', async () => {
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        const errorFixtures = loadErrorFixtures();
        const modelNotFound = errorFixtures.modelNotFound;

        vi.mocked(axios.get).mockResolvedValue({
          data: modelNotFound.tagsResponse,
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: Readable.from([JSON.stringify({ done: true }) + '\n']),
        });

        await provider.generateCompletion('test', {
          model: modelNotFound.requestedModel,
          endpoint: 'http://localhost:11434',
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(modelNotFound.requestedModel)
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('ollama pull')
        );

        consoleSpy.mockRestore();
      });

      it('should not warn if model exists', async () => {
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'existing-model' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: Readable.from([JSON.stringify({ done: true }) + '\n']),
        });

        await provider.generateCompletion('test', {
          model: 'existing-model',
          endpoint: 'http://localhost:11434',
        });

        // Should not have warned about missing model
        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should match model with :latest suffix', async () => {
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test-model:latest' }] },
        });

        vi.mocked(axios.post).mockResolvedValue({
          data: Readable.from([JSON.stringify({ done: true }) + '\n']),
        });

        await provider.generateCompletion('test', {
          model: 'test-model',
          endpoint: 'http://localhost:11434',
        });

        // Should not warn - model exists with :latest suffix
        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    // T025: Stream interruption recovery
    describe('stream interruption handling', () => {
      it('should handle stream error gracefully', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });

        // Create a stream that will error
        const errorStream = new Readable({
          read() {
            this.destroy(new Error('Stream interrupted'));
          },
        });

        vi.mocked(axios.post).mockResolvedValue({ data: errorStream });

        const stream = await provider.generateCompletion('test', {
          model: 'test',
          endpoint: 'http://localhost:11434',
        });

        const chunks: string[] = [];
        for await (const chunk of stream as Readable) {
          chunks.push(chunk.toString());
        }

        // Should complete without throwing
        expect(chunks).toBeDefined();

        consoleSpy.mockRestore();
      });

      it('should handle Ollama error response in stream', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });

        // Stream with error response
        const errorChunks = [{ error: 'Model not loaded' }];
        vi.mocked(axios.post).mockResolvedValue({
          data: createMockStream(errorChunks as any),
        });

        const stream = await provider.generateCompletion('test', {
          model: 'test',
          endpoint: 'http://localhost:11434',
        });

        const chunks: string[] = [];
        for await (const chunk of stream as Readable) {
          chunks.push(chunk.toString());
        }

        // Should log error and complete
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Model not loaded')
        );

        consoleSpy.mockRestore();
      });
    });

    // Additional error scenarios
    describe('network error handling', () => {
      it('should handle ENETUNREACH error', async () => {
        const axiosError = createAxiosError(
          'ENETUNREACH',
          'Network unreachable'
        );

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', { model: 'test' })
        ).rejects.toThrow(/Cannot reach Ollama/);
      });

      it('should handle EHOSTUNREACH error', async () => {
        const axiosError = createAxiosError('EHOSTUNREACH', 'Host unreachable');

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', { model: 'test' })
        ).rejects.toThrow(/Cannot reach Ollama/);
      });

      it('should handle 404 HTTP error', async () => {
        const axiosError = new Error('Request failed') as AxiosError;
        (axiosError as any).isAxiosError = true;
        (axiosError as any).response = { status: 404 };

        vi.mocked(axios.get).mockResolvedValue({
          data: { models: [{ name: 'test' }] },
        });
        vi.mocked(axios.post).mockRejectedValue(axiosError);

        await expect(
          provider.generateCompletion('test', { model: 'test' })
        ).rejects.toThrow(/endpoint not found/);
      });
    });
  });

  // ============================================================
  // Phase 7: Edge Cases and Special Characters
  // ============================================================

  describe('Edge Cases', () => {
    // T038: Model name with special characters
    it('should handle model names with special characters', async () => {
      const specialModel = 'qwen2.5-coder:14b-instruct-q4_K_M';

      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: specialModel }] },
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: Readable.from([JSON.stringify({ done: true }) + '\n']),
      });

      await provider.generateCompletion('test', {
        model: specialModel,
        endpoint: 'http://localhost:11434',
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: specialModel,
        }),
        expect.any(Object)
      );
    });

    // T039: Extremely long response handling
    it('should handle extremely long responses', async () => {
      // Generate a response with many chunks
      const longContent = 'x'.repeat(100);
      const manyChunks = Array.from({ length: 50 }, (_, i) => ({
        model: 'test',
        message: { role: 'assistant' as const, content: `${longContent}-${i}` },
        done: false,
      }));
      manyChunks.push({ model: 'test', done: true } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'test' }] },
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: createMockStream(manyChunks),
      });

      const stream = await provider.generateCompletion('test', {
        model: 'test',
        endpoint: 'http://localhost:11434',
      });

      const chunks: string[] = [];
      for await (const chunk of stream as Readable) {
        chunks.push(chunk.toString());
      }

      const fullData = chunks.join('');
      // Should contain all chunks
      expect(fullData.match(/data: \{/g)?.length).toBeGreaterThanOrEqual(50);
      expect(fullData).toContain('data: [DONE]');
    });
  });

  // ============================================================
  // validateConfig tests
  // ============================================================

  describe('validateConfig', () => {
    it('should not throw for any configuration', () => {
      expect(() => provider.validateConfig({})).not.toThrow();
      expect(() =>
        provider.validateConfig({ endpoint: 'http://localhost:11434' })
      ).not.toThrow();
    });
  });
});
