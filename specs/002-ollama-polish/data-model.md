# Data Model: Ollama Provider Polish and Testing

**Feature**: 002-ollama-polish
**Date**: 2026-01-30

## Entities

### OllamaProvider

Implements the `CompletionProvider` interface for Ollama API communication.

| Field       | Type | Description                               |
| ----------- | ---- | ----------------------------------------- |
| (stateless) | -    | Provider is stateless, no instance fields |

**Methods**:
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| validateConfig | options: CompletionOptions | void | Validates Ollama configuration (no-op currently) |
| generateCompletion | prompt: string, options: CompletionOptions | Promise<Readable> | Generates completion via Ollama API |

### CompletionOptions (from types.ts)

| Field    | Type   | Required | Default                  | Description         |
| -------- | ------ | -------- | ------------------------ | ------------------- |
| model    | string | No       | 'qwen2.5-coder:14b'      | Model name          |
| apiKey   | string | No       | -                        | Not used for Ollama |
| endpoint | string | No       | 'http://localhost:11434' | Ollama host URL     |

### Config Entry: OLLAMA_HOST

| Field       | Type   | Validation                         | Default                  |
| ----------- | ------ | ---------------------------------- | ------------------------ |
| OLLAMA_HOST | string | Valid URL with http/https protocol | 'http://localhost:11434' |

**Validation Rules**:

- Must be valid URL format
- Must use http: or https: protocol
- Must not be empty if explicitly set

## State Transitions

### Request Lifecycle

```
[Initial] --> [Checking Model] --> [Requesting] --> [Streaming] --> [Complete]
    |              |                   |               |
    v              v                   v               v
[Config Error] [Model Warning] [Connection Error] [Stream Error]
```

**States**:

1. **Initial**: Provider instantiated, no active request
2. **Checking Model**: GET /api/tags to verify model exists
3. **Requesting**: POST /api/chat with streaming enabled
4. **Streaming**: Receiving ndjson chunks, converting to SSE
5. **Complete**: Stream ended with done: true

**Error States**:

- **Config Error**: Invalid OLLAMA_HOST format
- **Model Warning**: Model not found (warning only, continues)
- **Connection Error**: Cannot reach Ollama (ECONNREFUSED, ETIMEDOUT)
- **Stream Error**: Interruption during streaming

## Data Flow

### Ollama API Response Format (ndjson)

```json
{"model":"qwen2.5-coder:14b","created_at":"...","message":{"role":"assistant","content":"ls"},"done":false}
{"model":"qwen2.5-coder:14b","created_at":"...","message":{"role":"assistant","content":" -la"},"done":false}
{"model":"qwen2.5-coder:14b","created_at":"...","message":{"role":"assistant","content":""},"done":true}
```

### Converted SSE Format (output)

```
data: {"choices":[{"delta":{"content":"ls"}}]}

data: {"choices":[{"delta":{"content":" -la"}}]}

data: [DONE]

```

## Test Fixtures Schema

### Recorded Response Fixture

```typescript
interface OllamaFixture {
  name: string; // Fixture identifier
  description?: string; // Human-readable description
  request: {
    prompt: string; // Input prompt
    model: string; // Model used
  };
  response: {
    chunks: OllamaChunk[]; // Response chunks in order
    delayMs?: number; // Optional delay between chunks
  };
  error?: {
    // For error scenario fixtures
    code: string; // e.g., 'ECONNREFUSED', 'ETIMEDOUT'
    message: string;
  };
}

interface OllamaChunk {
  model?: string;
  created_at?: string;
  message?: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
}
```

## Relationships

```
┌─────────────────┐     uses      ┌─────────────────┐
│  completion.ts  │──────────────>│ OllamaProvider  │
└─────────────────┘               └─────────────────┘
        │                                 │
        │ reads                           │ calls
        v                                 v
┌─────────────────┐               ┌─────────────────┐
│   config.ts     │               │  Ollama API     │
│ (OLLAMA_HOST)   │               │ /api/chat       │
└─────────────────┘               │ /api/tags       │
                                  └─────────────────┘
```
