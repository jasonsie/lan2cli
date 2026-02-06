# Research: Ollama Provider Polish and Testing

**Feature**: 002-ollama-polish
**Date**: 2026-01-30

## Ollama API Reference (from Context7)

### Chat Endpoint

**POST /api/chat**

Request body:

- `model` (string) - Required - Model name
- `messages` (array) - Required - Chat history
  - `role` (string) - 'user', 'system', or 'assistant'
  - `content` (string) - Message content
- `stream` (boolean) - Optional - Enable streaming (default: true)
- `keep_alive` (string|number) - Optional - How long to keep model loaded

### Streaming Response Format (ndjson)

```json
{"model":"qwen2.5-coder:14b","created_at":"...","message":{"role":"assistant","content":"ls"},"done":false}
{"model":"qwen2.5-coder:14b","created_at":"...","message":{"role":"assistant","content":" -la"},"done":false}
{"model":"qwen2.5-coder:14b","created_at":"...","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}
```

### Streaming Error Format

```json
{"model":"...","created_at":"...","response":"partial","done":false}
{"error":"an error was encountered while running the model"}
```

### List Models Endpoint

**GET /api/tags**

Response:

```json
{
  "models": [
    {
      "name": "qwen2.5-coder:14b",
      "modified_at": "2024-04-20T12:00:00.000Z",
      "size": 1000000000,
      "digest": "sha256:...",
      "details": {
        "format": "gguf",
        "parameter_size": "14B",
        "quantization_level": "Q4_0"
      }
    }
  ]
}
```

### Common Error Codes

- **404**: Model not found
- **Connection refused**: Ollama service not running
- **Timeout**: Server unresponsive

## Research Tasks

### 1. Axios Timeout Configuration

**Decision**: Use axios `timeout` option for 10-second connection timeout

**Rationale**:

- Axios natively supports timeout via config option
- Single configuration point for both connection and response timeout
- Consistent with existing codebase patterns (already using axios)

**Implementation**:

```typescript
const response = await axios.post(url, data, {
  responseType: 'stream',
  timeout: 10000, // 10 seconds
});
```

**Alternatives considered**:

- AbortController with setTimeout: More complex, requires cleanup
- axios-retry with timeout: Adds dependency, not needed for simple timeout

### 2. Record/Replay Test Strategy

**Decision**: Use vitest mocking with JSON fixture files

**Rationale**:

- Vitest already in use, no new dependencies
- JSON fixtures are portable and version-controllable
- Mocking at axios level provides full control over responses

**Implementation**:

- Store fixtures in `tests/fixtures/ollama/`
- Load fixtures in test setup
- Mock axios.post to return fixture data as streams

**Fixture Structure**:

```json
{
  "name": "command-generation-ls",
  "request": {
    "prompt": "list files in current directory",
    "model": "qwen2.5-coder:14b"
  },
  "response": {
    "chunks": [
      { "message": { "content": "ls" }, "done": false },
      { "message": { "content": " -la" }, "done": false },
      { "done": true }
    ]
  }
}
```

**Alternatives considered**:

- nock: HTTP mocking library, adds dependency
- msw: Service worker approach, overkill for CLI tests
- polly.js: Recording proxy, complex setup

### 3. URL Validation Approach

**Decision**: Use native URL constructor for OLLAMA_HOST validation

**Rationale**:

- No additional dependencies (Zod not required)
- URL constructor throws on invalid URLs
- Sufficient for validating host:port format

**Implementation**:

```typescript
function validateOllamaHost(host: string): boolean {
  try {
    const url = new URL(host);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
```

**Alternatives considered**:

- Zod URL schema: Adds dependency for single validation
- Regex: Error-prone, doesn't validate all edge cases

### 4. Error Message Internationalization

**Decision**: Add Ollama-specific error messages to i18n system

**Rationale**:

- Project already uses i18next with 16 language translations
- Consistent with existing error handling patterns
- User-friendly localized error messages

**New Keys Required**:

- `error.ollama.unreachable`: "Cannot connect to Ollama at {host}"
- `error.ollama.timeout`: "Connection timed out after {seconds}s"
- `error.ollama.model_not_found`: "Model '{model}' not found. Run: ollama pull {model}"
- `error.ollama.invalid_host`: "Invalid Ollama host URL: {host}"

**Alternatives considered**:

- Hardcoded English strings: Inconsistent with existing i18n
- Template literals only: Loses translation capability

### 5. Test Coverage Strategy

**Decision**: Focus on OllamaProvider and config.ts for 80% coverage

**Files to cover**:
| File | Current Coverage | Target | Priority |
|------|-----------------|--------|----------|
| ollama.ts | ~40% (estimated) | 80% | P1 |
| config.ts | ~60% (estimated) | 80% | P1 |
| completion.ts | ~30% (estimated) | 60% | P2 |

**Test Scenarios to Add**:

1. Timeout handling (FR-011)
2. Connection refused error (FR-006)
3. Empty response handling (edge case)
4. Invalid URL validation (FR-008)
5. Stream interruption recovery (FR-010)
6. Model availability check with various responses (FR-005)

**Rationale**:

- Focused coverage on modified files
- Edge cases identified in spec
- Record/replay approach simplifies integration tests

## Dependencies

No new dependencies required. All functionality achievable with:

- axios (existing)
- vitest (existing)
- i18next (existing)
- Native URL constructor
