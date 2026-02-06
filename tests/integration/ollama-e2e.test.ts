import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../src/helpers/providers/ollama';
import axios, { AxiosError } from 'axios';
import { Readable } from 'stream';
import {
  loadCommandGenerationFixture,
  loadErrorFixtures,
  loadStreamingChunks,
  createMockStream,
  createAxiosError,
} from '../fixtures/ollama/loader';

vi.mock('axios');

describe('Ollama E2E Integration Tests', () => {
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
  // T014: Integration test for command generation using recorded fixtures
  // ============================================================
  describe('US1: Command Generation E2E', () => {
    it('should generate a shell command from natural language using fixtures', async () => {
      const fixture = loadCommandGenerationFixture();

      // Mock model availability check
      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: fixture.request.model }] },
      });

      // Mock the streaming response
      const mockStream = createMockStream(fixture.response.chunks);
      vi.mocked(axios.post).mockResolvedValue({ data: mockStream });

      // Execute
      const stream = await provider.generateCompletion(fixture.request.prompt, {
        model: fixture.request.model,
        endpoint: 'http://localhost:11434',
      });

      // Collect the streamed response
      const chunks: string[] = [];
      for await (const chunk of stream as Readable) {
        chunks.push(chunk.toString());
      }

      const fullResponse = chunks.join('');

      // Verify the response contains expected SSE format
      expect(fullResponse).toContain('data: ');
      expect(fullResponse).toContain('data: [DONE]');

      // Verify the response contains the shell command from fixture
      expect(fullResponse).toContain('ls');
    });

    it('should complete full streaming cycle with multi-chunk response', async () => {
      const streamingChunks = loadStreamingChunks();

      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'qwen2.5-coder:14b' }] },
      });

      const mockStream = createMockStream(streamingChunks);
      vi.mocked(axios.post).mockResolvedValue({ data: mockStream });

      const stream = await provider.generateCompletion(
        'list all files in current directory',
        {
          model: 'qwen2.5-coder:14b',
          endpoint: 'http://localhost:11434',
        }
      );

      const chunks: string[] = [];
      for await (const chunk of stream as Readable) {
        chunks.push(chunk.toString());
      }

      const fullResponse = chunks.join('');

      // Should contain all tokens from streaming chunks
      expect(fullResponse).toContain('"content":"To"');
      expect(fullResponse).toContain('"content":" list"');
      expect(fullResponse).toContain('"content":"ls"');
      expect(fullResponse).toContain('"content":" -la"');
      expect(fullResponse).toContain('data: [DONE]');
    });
  });

  // ============================================================
  // T021: Integration test for error scenarios using error fixtures
  // ============================================================
  describe('US2: Error Handling E2E', () => {
    it('should handle Ollama not running scenario', async () => {
      const errorFixtures = loadErrorFixtures();
      const connError = errorFixtures.connectionRefused;

      // Mock model check to pass, but main request to fail
      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'test-model' }] },
      });

      const axiosError = createAxiosError(
        connError.error.code,
        connError.error.message
      );
      vi.mocked(axios.post).mockRejectedValue(axiosError);

      await expect(
        provider.generateCompletion('test prompt', {
          model: 'test-model',
          endpoint: 'http://localhost:11434',
        })
      ).rejects.toThrow(/Cannot connect to Ollama/);
    });

    it('should handle timeout scenario', async () => {
      const errorFixtures = loadErrorFixtures();
      const timeoutError = errorFixtures.timeout;

      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'test-model' }] },
      });

      const axiosError = createAxiosError(
        timeoutError.error.code,
        timeoutError.error.message
      );
      vi.mocked(axios.post).mockRejectedValue(axiosError);

      await expect(
        provider.generateCompletion('test prompt', {
          model: 'test-model',
          endpoint: 'http://localhost:11434',
        })
      ).rejects.toThrow(/timed out/);
    });

    it('should warn when model is not found but continue', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorFixtures = loadErrorFixtures();
      const modelNotFound = errorFixtures.modelNotFound;

      // Mock tags response without the requested model
      vi.mocked(axios.get).mockResolvedValue({
        data: modelNotFound.tagsResponse,
      });

      // Mock successful completion (Ollama will try to pull the model)
      vi.mocked(axios.post).mockResolvedValue({
        data: Readable.from([JSON.stringify({ done: true }) + '\n']),
      });

      await provider.generateCompletion('test', {
        model: modelNotFound.requestedModel,
        endpoint: 'http://localhost:11434',
      });

      // Should have warned about missing model
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(modelNotFound.requestedModel)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ollama pull')
      );

      consoleSpy.mockRestore();
    });

    it('should handle stream interruption gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const errorFixtures = loadErrorFixtures();
      const streamInterruption = errorFixtures.streamInterruption;

      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'test-model' }] },
      });

      // Create stream with partial chunks followed by error
      const mockStream = createMockStream(
        streamInterruption.partialChunks as any
      );
      vi.mocked(axios.post).mockResolvedValue({ data: mockStream });

      const stream = await provider.generateCompletion('test', {
        model: 'test-model',
        endpoint: 'http://localhost:11434',
      });

      const chunks: string[] = [];
      for await (const chunk of stream as Readable) {
        chunks.push(chunk.toString());
      }

      // Should have received partial response before error
      const fullResponse = chunks.join('');
      expect(fullResponse).toContain('data: ');

      // Error should have been logged (matches the fixture error message)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('an error was encountered')
      );

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // T032: Integration test for chat mode with Ollama
  // ============================================================
  describe('US4: Chat Mode E2E', () => {
    it('should handle multi-turn conversation', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'qwen2.5-coder:14b' }] },
      });

      // First turn
      const turn1Chunks = [
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: 'Hello!' },
          done: false,
        },
        { model: 'qwen2.5-coder:14b', done: true, done_reason: 'stop' },
      ];

      vi.mocked(axios.post).mockResolvedValue({
        data: createMockStream(turn1Chunks),
      });

      const stream1 = await provider.generateCompletion('Hi there', {
        model: 'qwen2.5-coder:14b',
        endpoint: 'http://localhost:11434',
      });

      const chunks1: string[] = [];
      for await (const chunk of stream1 as Readable) {
        chunks1.push(chunk.toString());
      }

      expect(chunks1.join('')).toContain('"content":"Hello!"');

      // Second turn
      const turn2Chunks = [
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: 'Use `ls -la`' },
          done: false,
        },
        { model: 'qwen2.5-coder:14b', done: true, done_reason: 'stop' },
      ];

      vi.mocked(axios.post).mockResolvedValue({
        data: createMockStream(turn2Chunks),
      });

      const stream2 = await provider.generateCompletion(
        'How do I list files?',
        {
          model: 'qwen2.5-coder:14b',
          endpoint: 'http://localhost:11434',
        }
      );

      const chunks2: string[] = [];
      for await (const chunk of stream2 as Readable) {
        chunks2.push(chunk.toString());
      }

      expect(chunks2.join('')).toContain('ls -la');
    });

    it('should use correct API format for chat messages', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'test-model' }] },
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: Readable.from([JSON.stringify({ done: true }) + '\n']),
      });

      await provider.generateCompletion('Test message', {
        model: 'test-model',
        endpoint: 'http://localhost:11434',
      });

      // Verify the correct chat API format is used
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          model: 'test-model',
          messages: [{ role: 'user', content: 'Test message' }],
          stream: true,
        }),
        expect.objectContaining({
          responseType: 'stream',
          timeout: 10000,
        })
      );
    });
  });

  // ============================================================
  // Full E2E Scenario Tests
  // ============================================================
  describe('Full E2E Scenarios', () => {
    it('should complete a realistic command generation flow', async () => {
      // This test simulates a real user flow:
      // 1. User asks for a command
      // 2. Ollama streams the response
      // 3. User gets a properly formatted shell command

      const realisticChunks = [
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: 'To find' },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: ' all' },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: ' Python' },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: ' files' },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: ', use' },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: ':\n\n' },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: '```bash\n' },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: {
            role: 'assistant' as const,
            content: 'find . -name "*.py"\n',
          },
          done: false,
        },
        {
          model: 'qwen2.5-coder:14b',
          message: { role: 'assistant' as const, content: '```' },
          done: false,
        },
        { model: 'qwen2.5-coder:14b', done: true, done_reason: 'stop' },
      ];

      vi.mocked(axios.get).mockResolvedValue({
        data: { models: [{ name: 'qwen2.5-coder:14b' }] },
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: createMockStream(realisticChunks),
      });

      const stream = await provider.generateCompletion(
        'find all python files',
        {
          model: 'qwen2.5-coder:14b',
          endpoint: 'http://localhost:11434',
        }
      );

      const chunks: string[] = [];
      for await (const chunk of stream as Readable) {
        chunks.push(chunk.toString());
      }

      const fullResponse = chunks.join('');

      // Verify the command is in the response
      expect(fullResponse).toContain('find . -name');
      expect(fullResponse).toContain('*.py');
      expect(fullResponse).toContain('data: [DONE]');
    });
  });
});
