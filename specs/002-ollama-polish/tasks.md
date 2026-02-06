# Tasks: Ollama Provider Polish and Testing

**Input**: Design documents from `/specs/002-ollama-polish/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are REQUIRED for this feature (TR-001 through TR-005, SC-003 requires 80% coverage)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths use the existing project structure from plan.md

---

## Phase 1: Setup (Test Infrastructure)

**Purpose**: Create test fixtures directory and base infrastructure for record/replay testing

- [x] T001 Create test fixtures directory structure at tests/fixtures/ollama/
- [x] T002 [P] Create command-generation.json fixture with sample ndjson response in tests/fixtures/ollama/command-generation.json
- [x] T003 [P] Create error-responses.json fixture with connection refused and timeout scenarios in tests/fixtures/ollama/error-responses.json
- [x] T004 [P] Create streaming-chunks.ndjson fixture with multi-chunk streaming example in tests/fixtures/ollama/streaming-chunks.ndjson
- [x] T005 Create fixture loader utility function in tests/fixtures/ollama/loader.ts

---

## Phase 2: Foundational (Timeout and Error Infrastructure)

**Purpose**: Core infrastructure that MUST be complete before user story testing can be comprehensive

**WARNING**: User story validation depends on this phase completing first

- [x] T006 Add 10-second timeout configuration to axios requests in src/helpers/providers/ollama.ts
- [x] T007 [P] Add i18n error message keys for Ollama errors in src/helpers/i18n.ts (error.ollama.unreachable, error.ollama.timeout, error.ollama.model_not_found, error.ollama.invalid_host)
- [x] T008 [P] Add OLLAMA_HOST URL validation function using native URL constructor in src/helpers/config.ts
- [x] T009 Implement connection error handling with user-friendly messages in src/helpers/providers/ollama.ts
- [x] T010 Implement timeout error handling with user-friendly messages in src/helpers/providers/ollama.ts

**Checkpoint**: Foundation ready - timeout handling and error messages in place

---

## Phase 3: User Story 1 - Basic Command Generation with Ollama (Priority: P1) MVP

**Goal**: Validate core Ollama provider works for command generation with streaming responses

**Independent Test**: Configure Ollama as provider, run `ai "list files"`, verify shell command generated and streamed

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation changes**

- [x] T011 [P] [US1] Unit test for generateCompletion with successful streaming in tests/unit/providers/ollama.test.ts
- [x] T012 [P] [US1] Unit test for ndjson to SSE format conversion in tests/unit/providers/ollama.test.ts
- [x] T013 [P] [US1] Unit test for default model (qwen2.5-coder:14b) usage in tests/unit/providers/ollama.test.ts
- [x] T014 [US1] Integration test for command generation using recorded fixtures in tests/integration/ollama-e2e.test.ts

### Implementation for User Story 1

- [x] T015 [US1] Verify streaming response format conversion in src/helpers/providers/ollama.ts matches SSE spec
- [x] T016 [US1] Add empty response handling in src/helpers/providers/ollama.ts (edge case)
- [x] T017 [US1] Verify default model constant qwen2.5-coder:14b in src/helpers/providers/ollama.ts

**Checkpoint**: User Story 1 complete - basic command generation works with Ollama

---

## Phase 4: User Story 2 - Graceful Error Handling for Ollama (Priority: P1)

**Goal**: User receives helpful error messages when Ollama is unavailable or misconfigured

**Independent Test**: Stop Ollama service, run command, verify error message guides user to resolution

### Tests for User Story 2

- [x] T018 [P] [US2] Unit test for connection refused error handling in tests/unit/providers/ollama.test.ts
- [x] T019 [P] [US2] Unit test for timeout error handling (10s) in tests/unit/providers/ollama.test.ts
- [x] T020 [P] [US2] Unit test for model not found warning in tests/unit/providers/ollama.test.ts
- [x] T021 [US2] Integration test for error scenarios using error fixtures in tests/integration/ollama-e2e.test.ts

### Implementation for User Story 2

- [x] T022 [US2] Implement ECONNREFUSED error handler with i18n message in src/helpers/providers/ollama.ts
- [x] T023 [US2] Implement ETIMEDOUT error handler with i18n message in src/helpers/providers/ollama.ts
- [x] T024 [US2] Improve model not found warning with actionable message (ollama pull command) in src/helpers/providers/ollama.ts
- [x] T025 [US2] Implement stream interruption recovery in src/helpers/providers/ollama.ts

**Checkpoint**: User Story 2 complete - all error scenarios display actionable guidance

---

## Phase 5: User Story 3 - Configuration Management for Ollama (Priority: P2)

**Goal**: Users can configure OLLAMA_HOST and model through config UI and CLI

**Independent Test**: Run `ai config set OLLAMA_HOST=http://custom:11434`, verify persistence and usage

### Tests for User Story 3

- [x] T026 [P] [US3] Unit test for OLLAMA_HOST validation (valid/invalid URLs) in tests/unit/config.test.ts
- [x] T027 [P] [US3] Unit test for OLLAMA_HOST persistence and retrieval in tests/unit/config.test.ts
- [x] T028 [US3] Unit test for config UI prompting for OLLAMA_HOST when Ollama selected in tests/unit/config.test.ts

### Implementation for User Story 3

- [x] T029 [US3] Add OLLAMA_HOST validation before storing in src/helpers/config.ts
- [x] T030 [US3] Add OLLAMA_HOST input to interactive config UI in src/helpers/config.ts (showConfigUI)
- [x] T031 [US3] Verify OLLAMA_HOST is used by OllamaProvider from config in src/helpers/completion.ts

**Checkpoint**: User Story 3 complete - configuration changes persist and are used

---

## Phase 6: User Story 4 - Interactive Chat Mode with Ollama (Priority: P2)

**Goal**: Chat mode works with Ollama maintaining conversation context

**Independent Test**: Run `ai chat` with Ollama configured, have multi-turn conversation, verify context maintained

### Tests for User Story 4

- [x] T032 [P] [US4] Integration test for chat mode with Ollama in tests/integration/ollama-e2e.test.ts
- [x] T033 [US4] Create chat-session.json fixture with multi-turn conversation in tests/fixtures/ollama/chat-session.json

### Implementation for User Story 4

- [x] T034 [US4] Verify chat command uses OllamaProvider correctly in src/commands/chat.ts
- [x] T035 [US4] Verify message history is passed to Ollama API in src/helpers/providers/ollama.ts

**Checkpoint**: User Story 4 complete - chat mode maintains context across turns

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Coverage verification, edge cases, and documentation

- [x] T036 [P] Run test coverage report and verify 80% coverage for ollama.ts (achieved: 86.01%)
- [x] T037 [P] Run test coverage report and verify 80% coverage for config.ts (OLLAMA_HOST parts) (achieved: validation at 97.43% branch coverage)
- [x] T038 [P] Add test for model name with special characters (e.g., qwen2.5-coder:14b-instruct-q4_K_M) in tests/unit/providers/ollama.test.ts
- [x] T039 [P] Add test for extremely long response handling in tests/unit/providers/ollama.test.ts
- [x] T040 Update quickstart.md with actual test commands and verification steps in specs/002-ollama-polish/quickstart.md
- [x] T041 Run all tests and verify green build (64 tests passing)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T005) - BLOCKS comprehensive testing
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P2)
  - US1 and US2 are both P1 - can be parallelized
  - US3 and US4 are both P2 - can be parallelized after P1 stories
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2/US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Implementation follows tests
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks T002-T004 marked [P] can run in parallel
- Foundational tasks T007-T008 marked [P] can run in parallel
- US1 tests T011-T013 marked [P] can run in parallel
- US2 tests T018-T020 marked [P] can run in parallel
- US3 tests T026-T027 marked [P] can run in parallel
- US1 and US2 (both P1) can be worked on in parallel
- US3 and US4 (both P2) can be worked on in parallel
- Polish tasks T036-T039 marked [P] can run in parallel

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for generateCompletion with successful streaming in tests/unit/providers/ollama.test.ts"
Task: "Unit test for ndjson to SSE format conversion in tests/unit/providers/ollama.test.ts"
Task: "Unit test for default model (qwen2.5-coder:14b) usage in tests/unit/providers/ollama.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup (test fixtures)
2. Complete Phase 2: Foundational (timeout, error handling infrastructure)
3. Complete Phase 3: User Story 1 (basic command generation)
4. Complete Phase 4: User Story 2 (error handling)
5. **STOP and VALIDATE**: Test US1 and US2 independently
6. Verify 80% coverage for core changes

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Verify streaming works
3. Add User Story 2 → Test independently → Verify errors handled
4. Add User Story 3 → Test independently → Verify config works
5. Add User Story 4 → Test independently → Verify chat works
6. Polish → Verify coverage → Final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD approach: Write tests first, verify they fail, then implement
- Commit after each task or logical group
- Use recorded fixtures for deterministic tests
- Target: 80% code coverage for ollama.ts and config.ts
