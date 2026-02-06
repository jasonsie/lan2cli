# Research: Multi-Provider Support

**Date**: 2026-01-29
**Status**: Completed

## 1. Testing Framework

**Decision**: Use `vitest`.
**Rationale**:

- Fast, native TypeScript support.
- Compatible with the existing ESM setup (`type: module`).
- Minimal configuration required compared to Jest.
- Satisfies Constitution Principle III (Test-First).

## 2. Gemini Integration

**Decision**: Use `@google/generative-ai` SDK.
**Rationale**:

- Official Google SDK provides type safety and simplifies API interaction (streaming, auth).
- Better long-term maintenance than maintaining raw REST calls.
  **Alternatives Considered**:
- Raw REST via `axios`: Rejected due to complexity of managing streaming parsing and auth headers manually.

## 3. Ollama Integration

**Decision**: Use `axios` (Raw REST).
**Rationale**:

- Ollama API is simple (`POST /api/chat`).
- `axios` is already a project dependency.
- Avoids adding another dependency for a simple local API.
  **Alternatives Considered**:
- `ollama` npm package: Rejected to keep dependency count low for a simple endpoint.

## 4. Provider Abstraction

**Decision**: Strategy Pattern (`CompletionProvider` interface).
**Rationale**:

- Allows swapping `OpenAI`, `Gemini`, `Ollama` implementations at runtime.
- Extensible for future providers (e.g., Anthropic).
- Interface: `generateCompletion(prompt, options) -> Stream`.

## Open Questions Resolved

- **NEEDS CLARIFICATION: Testing**: `vitest` selected.
- **NEEDS CLARIFICATION: Gemini**: SDK selected.
