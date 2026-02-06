# Implementation Plan: Ollama Provider Polish and Testing

**Branch**: `002-ollama-polish` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-ollama-polish/spec.md`

## Summary

Polish and test the existing Ollama local-model provider implementation to ensure production readiness. The provider already implements core functionality (streaming, model checking, configuration). This plan focuses on: adding timeout handling (10s), improving error messages, expanding test coverage to 80%+, and implementing record/replay test fixtures.

## Technical Context

**Language/Version**: TypeScript 4.9.5, Node.js 18+
**Primary Dependencies**: axios 1.3.5 (HTTP), vitest 3.2.4 (testing), ini 4.0.0 (config)
**Storage**: INI file at ~/.ai-shell (config persistence)
**Testing**: vitest with mocked axios
**Target Platform**: Cross-platform CLI (macOS, Linux, Windows)
**Project Type**: Single CLI application
**Performance Goals**: 5 seconds for typical command generation (SC-001)
**Constraints**: 10 second connection timeout (FR-011), 80% code coverage (SC-003)
**Scale/Scope**: Single-user CLI tool, local Ollama instance

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

The constitution template is not populated with project-specific principles. Applying CLAUDE.md guidelines:

| Principle                    | Status  | Notes                                                   |
| ---------------------------- | ------- | ------------------------------------------------------- |
| TDD: Write tests first       | PASS    | Plan includes test-first approach per TR-001-TR-005     |
| 80% minimum coverage         | PASS    | SC-003 requires 80% coverage for Ollama code            |
| Small files (200-400 lines)  | PASS    | ollama.ts is ~100 lines, tests ~65 lines                |
| No console.log in production | REVIEW  | Current warnings use console.warn - acceptable for CLI  |
| Proper error handling        | PASS    | FR-006, FR-010, FR-011 address error scenarios          |
| Input validation with Zod    | PARTIAL | FR-008 requires URL validation, not currently using Zod |

**Gate Result**: PASS - No blocking violations. URL validation can use native URL constructor.

## Project Structure

### Documentation (this feature)

```text
specs/002-ollama-polish/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no new APIs)
├── checklists/          # Quality checklists
│   └── requirements.md  # Spec validation checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── cli.ts                    # CLI entry point
├── prompt.ts                 # Prompt handling
├── commands/
│   ├── chat.ts               # Chat mode
│   └── config.ts             # Configuration management
└── helpers/
    ├── providers/
    │   ├── types.ts          # Provider interfaces
    │   ├── index.ts          # Provider factory
    │   ├── ollama.ts         # Ollama provider (FOCUS)
    │   ├── openai.ts         # OpenAI provider
    │   └── gemini.ts         # Gemini provider
    ├── config.ts             # Config management (FOCUS)
    ├── completion.ts         # Completion orchestration
    └── error.ts              # Error handling

tests/
├── unit/
│   ├── providers/
│   │   ├── ollama.test.ts    # Unit tests (EXPAND)
│   │   └── gemini.test.ts
│   └── config.test.ts        # Config tests (EXPAND)
├── integration/
│   ├── provider-switching.test.ts
│   └── ollama-e2e.test.ts    # NEW: End-to-end with fixtures
└── fixtures/                  # NEW: Recorded Ollama responses
    └── ollama/
        ├── command-generation.json
        ├── chat-session.json
        ├── error-responses.json
        └── streaming-chunks.ndjson
```

**Structure Decision**: Single project structure. Tests organized by type (unit/integration) with new fixtures directory for record/replay testing.

## Complexity Tracking

No constitution violations requiring justification.
