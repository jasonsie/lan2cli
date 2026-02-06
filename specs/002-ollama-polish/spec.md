# Feature Specification: Ollama Provider Polish and Testing

**Feature Branch**: `002-ollama-polish`
**Created**: 2026-01-30
**Status**: Draft
**Input**: User description: "Polish and test the Ollama local-model provider implementation with qwen2.5-coder:14b"

## Clarifications

### Session 2026-01-30

- Q: What should the connection timeout threshold be for Ollama requests? → A: 10 seconds
- Q: What test mocking strategy should be used for Ollama integration tests? → A: Record/replay - Capture real Ollama responses, replay in tests

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Basic Command Generation with Ollama (Priority: P1)

A developer wants to use their local Ollama instance with qwen2.5-coder:14b model to generate shell commands from natural language, without relying on cloud-based AI providers.

**Why this priority**: Core functionality that validates the Ollama provider works for the primary use case of the tool.

**Independent Test**: Can be fully tested by configuring Ollama as the provider and requesting a shell command. Delivers the core value of local, private AI-powered command generation.

**Acceptance Scenarios**:

1. **Given** Ollama is running locally with qwen2.5-coder:14b installed, **When** user runs `ai "list all files in current directory"`, **Then** the system generates a valid shell command (e.g., `ls -la`)
2. **Given** Ollama is configured as the provider, **When** user enters a natural language prompt, **Then** the response streams back in real-time without blocking
3. **Given** Ollama provider is selected, **When** user requests command explanation, **Then** the explanation is provided using the local model

---

### User Story 2 - Graceful Error Handling for Ollama (Priority: P1)

A developer attempts to use Ollama when it is not running or the model is not installed. The system should provide helpful error messages guiding them to resolve the issue.

**Why this priority**: Essential for user experience - users need clear guidance when things go wrong with local setup.

**Independent Test**: Can be tested by stopping Ollama service and verifying error messages guide users appropriately.

**Acceptance Scenarios**:

1. **Given** Ollama service is not running, **When** user attempts to generate a command, **Then** system displays a clear error message indicating Ollama is not reachable at the configured host
2. **Given** Ollama is running but qwen2.5-coder:14b is not installed, **When** user attempts to generate a command, **Then** system displays a warning with instructions to run `ollama pull qwen2.5-coder:14b`
3. **Given** network timeout occurs during response, **When** streaming is interrupted, **Then** system handles the error gracefully without crashing

---

### User Story 3 - Configuration Management for Ollama (Priority: P2)

A developer wants to configure their Ollama setup including the host URL and model selection through the interactive config menu or CLI commands.

**Why this priority**: Enables flexibility for users with non-default Ollama setups (remote servers, different models).

**Independent Test**: Can be tested by running config commands and verifying settings persist and are used in subsequent requests.

**Acceptance Scenarios**:

1. **Given** user runs `ai config`, **When** they select Ollama as provider, **Then** the system prompts for OLLAMA_HOST (with default http://localhost:11434)
2. **Given** user runs `ai config set OLLAMA_HOST=http://myserver:11434`, **When** they generate a command, **Then** the system connects to the specified host
3. **Given** user has custom model configured, **When** they switch provider to Ollama, **Then** system uses the configured model or defaults to qwen2.5-coder:14b

---

### User Story 4 - Interactive Chat Mode with Ollama (Priority: P2)

A developer wants to use Ollama in interactive chat mode for multi-turn conversations about shell commands and system administration tasks.

**Why this priority**: Extends the core functionality to support the chat feature with local models.

**Independent Test**: Can be tested by running `ai chat` with Ollama configured and having a multi-turn conversation.

**Acceptance Scenarios**:

1. **Given** Ollama is configured, **When** user runs `ai chat`, **Then** system enters interactive mode using the local model
2. **Given** chat session is active, **When** user asks follow-up questions, **Then** context is maintained across turns
3. **Given** chat session with Ollama, **When** user types `exit`, **Then** session ends cleanly

---

### Edge Cases

- What happens when Ollama returns an empty response?
- How does the system handle extremely long responses that exceed buffer limits?
- What happens when the model name contains special characters or version tags (e.g., `qwen2.5-coder:14b-instruct-q4_K_M`)?
- How does the system behave when switching from Ollama to another provider mid-session?
- What happens when OLLAMA_HOST is set to an invalid URL format?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST connect to Ollama at the configured host (default: http://localhost:11434)
- **FR-002**: System MUST use qwen2.5-coder:14b as the default model when no model is specified
- **FR-003**: System MUST stream responses from Ollama in real-time using the /api/chat endpoint
- **FR-004**: System MUST convert Ollama's ndjson response format to the expected SSE format for consistency
- **FR-005**: System MUST check for model availability before sending requests and warn if model is not found
- **FR-006**: System MUST display user-friendly error messages when Ollama is unreachable
- **FR-007**: System MUST support custom OLLAMA_HOST configuration via config file and CLI
- **FR-008**: System MUST validate OLLAMA_HOST is a valid URL format before storing
- **FR-009**: System MUST work in both single-prompt and chat modes with Ollama
- **FR-010**: System MUST handle streaming interruptions gracefully without crashing
- **FR-011**: System MUST timeout Ollama connection requests after 10 seconds and display a user-friendly timeout error

### Testing Requirements

- **TR-001**: Unit tests MUST cover OllamaProvider class methods (validateConfig, generateCompletion)
- **TR-002**: Integration tests MUST verify end-to-end command generation using recorded Ollama response fixtures (record/replay approach)
- **TR-003**: Error handling tests MUST cover connection failures, timeout scenarios, and invalid responses
- **TR-004**: Configuration tests MUST verify OLLAMA_HOST persistence and retrieval
- **TR-005**: Stream conversion tests MUST verify ndjson to SSE format transformation

### Key Entities

- **OllamaProvider**: The provider implementation that handles communication with Ollama's API, extending CompletionProvider interface
- **Config (OLLAMA_HOST)**: Configuration entry storing the Ollama server URL
- **Stream Converter**: Logic that transforms Ollama's ndjson streaming format to OpenAI-compatible SSE format

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can generate shell commands using local Ollama within 5 seconds for typical requests
- **SC-002**: 100% of error scenarios display actionable user guidance
- **SC-003**: All provider tests pass with minimum 80% code coverage for Ollama-related code
- **SC-004**: Configuration changes persist correctly across CLI sessions
- **SC-005**: Stream conversion produces valid SSE output that the existing parsing logic handles correctly
- **SC-006**: Chat mode maintains conversation context for at least 10 turns without degradation
