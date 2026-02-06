# Implementation Plan: Multi-Provider Support

**Branch**: `001-multi-provider-support` | **Date**: 2026-01-29 | **Spec**: [link](./spec.md)
**Input**: Feature specification from `/specs/001-multi-provider-support/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature introduces multi-provider support (Gemini and Ollama) alongside the existing OpenAI implementation. It refactors the current direct `openai` dependency into an agnostic `CompletionClient` interface, enabling users to switch providers via configuration. Default provider changes to Gemini for new users, while preserving OpenAI for existing configurations.

## Technical Context

**Language/Version**: TypeScript 4.9+ (Node.js 18+)
**Primary Dependencies**:

- Existing: `openai`, `axios`, `@clack/prompts`
- New: `@google/generative-ai`, `vitest` (dev)
  **Storage**: Local file system (`~/.ai-shell` config file)
  **Testing**: `vitest` (Unit & Integration)
  **Target Platform**: CLI (Node.js runtime, cross-platform)
  **Project Type**: Single CLI package
  **Performance Goals**: Minimal latency overhead (<100ms internal); streaming support required.
  **Constraints**:
- Must maintain existing `openai` config compatibility.
- Ollama requires local network access.
  **Scale/Scope**: 3 provider adapters, 1 interface refactor.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Library-First)**: PASSED. Logic remains in `src/helpers`.
- **Principle II (CLI Interface)**: PASSED. Enhances existing CLI.
- **Principle III (Test-First)**: **FAILED**. Project lacks a test runner.
  - _Remediation_: This plan explicitly includes adding `vitest` and writing tests for the new abstraction layer and providers.
- **Principle IV (Integration Testing)**: PASSED (Planned). Will test provider configs.

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-provider-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── helpers/
│   ├── providers/       # NEW: Provider implementations
│   │   ├── openai.ts
│   │   ├── gemini.ts
│   │   └── ollama.ts
│   ├── completion.ts    # REFACTOR: Delegates to providers
│   └── config.ts        # UPDATE: New keys
└── cli.ts

tests/                   # NEW: Test directory
├── unit/
│   └── providers/
└── integration/
```

**Structure Decision**: Refactor `src/helpers/completion.ts` to use a strategy pattern under `src/helpers/providers/`. Add `tests/` root directory for Vitest.

## Complexity Tracking

| Violation        | Why Needed                 | Simpler Alternative Rejected Because                                |
| ---------------- | -------------------------- | ------------------------------------------------------------------- |
| Adding `tests/`  | Constitution Principle III | Current "no tests" state violates core principles.                  |
| Strategy Pattern | Multiple providers         | "If/else" spaghetti in one file is unmaintainable for 3+ providers. |
