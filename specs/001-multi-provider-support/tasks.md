# Tasks: Multi-Provider Support

**Branch**: `001-multi-provider-support`
**Feature**: Multi-Provider Support (Gemini, Ollama)
**Status**: Plan Phase

## Phase 1: Setup & Infrastructure

- [x] T001 Install development dependencies (vitest, @types/node) for testing
- [x] T002 Install runtime dependencies (@google/generative-ai) for Gemini support
- [x] T003 Configure Vitest (`vitest.config.ts`) and add `test` script to package.json
- [x] T004 Create `tests/` directory structure (`unit`, `integration`)
- [x] T005 [P] Define `CompletionProvider` interface in `src/helpers/providers/types.ts` (move from contracts if needed)
- [x] T006 [P] Update `Config` type definition in `src/helpers/config.ts` to include new provider keys (`PROVIDER`, `GEMINI_KEY`, `OLLAMA_HOST`)

## Phase 2: Foundational (Blocking)

- [x] T007 Refactor `src/helpers/config.ts` to support reading/writing new provider config keys
- [x] T008 Implement `Config` validation logic (ensure valid provider selection)
- [x] T009 Create `src/helpers/providers/index.ts` factory to instantiate providers based on config
- [x] T010 [P] Create `tests/unit/config.test.ts` to verify config parsing and defaults

## Phase 3: User Story 1 - Configure Gemini (Priority: P1)

**Goal**: Enable Gemini as a first-class provider.
**Test**: `vitest run tests/unit/providers/gemini.test.ts`

- [x] T011 [US1] Create `src/helpers/providers/gemini.ts` implementing `CompletionProvider`
- [x] T012 [US1] Implement `validateConfig` for Gemini (check `GEMINI_KEY`)
- [x] T013 [US1] Implement `generateCompletion` using `@google/generative-ai` SDK
- [x] T014 [US1] Implement stream conversion for Gemini response to match existing CLI stream format
- [x] T015 [US1] Add `tests/unit/providers/gemini.test.ts` to mock SDK and verify behavior
- [x] T016 [US1] Update `src/helpers/completion.ts` to use provider factory and delegate to Gemini when configured

## Phase 4: User Story 2 - Configure Ollama (Priority: P2)

**Goal**: Enable local Ollama support.
**Test**: `vitest run tests/unit/providers/ollama.test.ts`

- [x] T017 [US2] Create `src/helpers/providers/ollama.ts` implementing `CompletionProvider`
- [x] T018 [US2] Implement `validateConfig` for Ollama (optional host check)
- [x] T019 [US2] Implement `generateCompletion` using `axios` (POST to `/api/chat`)
- [x] T020 [US2] Implement stream conversion for Ollama ndjson response
- [x] T021 [US2] Add `tests/unit/providers/ollama.test.ts` to mock axios and verify behavior
- [x] T022 [US2] Add warning logging for missing Ollama models (FR-010) before request

## Phase 5: User Story 3 - Seamless Switching & Polish (Priority: P3)

**Goal**: Frictionless switching and backward compatibility.
**Test**: `vitest run tests/integration/provider-switching.test.ts`

- [x] T023 [US3] Refactor `src/helpers/providers/openai.ts` to implement `CompletionProvider` (wrapping existing logic)
- [x] T024 [US3] Update `src/helpers/config.ts` UI (`showConfigUI`) to allow selecting provider from dropdown
- [x] T025 [US3] Implement fallback warning logic (FR-011) if `MODEL` config is incompatible with `PROVIDER`
- [x] T026 [US3] Create `tests/integration/provider-switching.test.ts` to verify config changes affect provider selection
- [x] T027 [US3] Verify OpenAI backward compatibility (existing users untouched)

## Phase 6: Polish & Final Review

- [x] T028 Update `README.md` with new provider configuration instructions
- [x] T029 Run full test suite and verify no regressions
- [x] T030 Perform manual verification using `specs/001-multi-provider-support/quickstart.md` scenarios

## Dependencies

- Phase 2 depends on Phase 1
- Phase 3, 4, 5 depend on Phase 2
- Phase 5 depends on Phase 3 and 4 (for full switching support)

## Parallel Execution Examples

- **Providers**: Gemini (T011-T015) and Ollama (T017-T021) implementations are independent and can be built in parallel once Phase 2 is done.
- **Tests**: Unit tests for providers can be written alongside their implementations.
