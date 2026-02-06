import { readFileSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

const fixturesDir = __dirname;

export interface OllamaChunk {
  model?: string;
  created_at?: string;
  message?: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  done_reason?: string;
  error?: string;
}

export interface OllamaFixture {
  name: string;
  description?: string;
  request: {
    prompt: string;
    model: string;
  };
  response: {
    chunks: OllamaChunk[];
    delayMs?: number;
  };
  error?: {
    code: string;
    message: string;
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;
  };
}

export interface ErrorFixtures {
  connectionRefused: {
    name: string;
    description: string;
    error: {
      code: string;
      message: string;
      errno: number;
      syscall: string;
      address: string;
      port: number;
    };
  };
  timeout: {
    name: string;
    description: string;
    error: {
      code: string;
      message: string;
    };
  };
  modelNotFound: {
    name: string;
    description: string;
    tagsResponse: {
      models: Array<{ name: string; modified_at: string; size: number }>;
    };
    requestedModel: string;
  };
  invalidHost: {
    name: string;
    description: string;
    host: string;
    expectedError: string;
  };
  streamInterruption: {
    name: string;
    description: string;
    partialChunks: Array<OllamaChunk | { error: string }>;
  };
}

/**
 * Load the command generation fixture
 */
export function loadCommandGenerationFixture(): OllamaFixture {
  const content = readFileSync(
    join(fixturesDir, 'command-generation.json'),
    'utf-8'
  );
  return JSON.parse(content);
}

/**
 * Load error response fixtures
 */
export function loadErrorFixtures(): ErrorFixtures {
  const content = readFileSync(
    join(fixturesDir, 'error-responses.json'),
    'utf-8'
  );
  return JSON.parse(content);
}

/**
 * Load streaming chunks from ndjson file
 */
export function loadStreamingChunks(): OllamaChunk[] {
  const content = readFileSync(
    join(fixturesDir, 'streaming-chunks.ndjson'),
    'utf-8'
  );
  return content
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

/**
 * Create a readable stream from fixture chunks (simulates Ollama response)
 */
export function createMockStream(chunks: OllamaChunk[]): Readable {
  const ndjsonLines = chunks.map((chunk) => JSON.stringify(chunk) + '\n');
  return Readable.from(ndjsonLines);
}

/**
 * Create an axios error object for testing
 */
export function createAxiosError(code: string, message: string): Error {
  const error = new Error(message) as Error & {
    code: string;
    isAxiosError: boolean;
  };
  error.code = code;
  error.isAxiosError = true;
  return error;
}
