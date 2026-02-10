# AI Shell

## Project Overview

AI Shell is a CLI tool that converts natural language to shell commands. It supports multiple AI providers (Gemini, OpenAI, Ollama) and offers both single-prompt and interactive chat modes. Built with TypeScript/Node.js using cleye for CLI parsing and @clack/prompts for interactive UI.

## Critical Rules

### 1. Code Organization

- Many small files over few large files
- High cohesion, low coupling
- 200-400 lines typical, 800 max per file
- Organize by feature/domain, not by type

### 2. Code Style

- No emojis in code, comments, or documentation
- Immutability always - never mutate objects or arrays
- Proper error handling with try/catch
- Input validation for all user inputs
- Use KnownError for user-facing errors

### 3. Security

- No hardcoded secrets
- Configuration stored in ~/.ai-shell INI file
- Validate all user inputs
- Secure API key storage with obfuscation in UI

## File Structure

```
ai-shell/
├── src/
│   ├── cli.ts              # CLI entry point using cleye
│   ├── prompt.ts           # Main prompt handler and user interaction flow
│   ├── commands/           # Command implementations
│   │   ├── chat.ts         # Interactive chat mode
│   │   ├── config.ts       # Configuration management UI
│   │   └── update.ts       # Self-update command
│   ├── helpers/            # Utility modules
│   │   ├── config.ts       # INI-based config management with parsers
│   │   ├── completion.ts   # Provider-agnostic completion orchestration
│   │   ├── error.ts        # KnownError class and handleCliError
│   │   ├── constants.ts    # commandName and projectName constants
│   │   ├── os-detect.ts    # Shell and OS detection
│   │   ├── shell-history.ts # Append commands to shell history
│   │   ├── stream-to-iterable.ts # Convert IncomingMessage to async iterable
│   │   ├── strip-regex-patterns.ts # Clean output from code blocks
│   │   └── providers/      # AI provider implementations
│   │       ├── types.ts    # CompletionProvider interface
│   │       ├── index.ts    # createProvider() factory function
│   │       ├── gemini.ts   # Google Gemini provider
│   │       ├── openai.ts   # OpenAI provider
│   │       └── ollama.ts   # Ollama local provider
├── tests/
│   ├── unit/
│   │   ├── config.test.ts
│   │   └── providers/
│   │       ├── gemini.test.ts
│   │       └── ollama.test.ts
│   ├── integration/
│   │   ├── provider-switching.test.ts
│   │   └── ollama-e2e.test.ts
│   └── fixtures/
├── specs/                  # Feature specifications
│   ├── 001-multi-provider-support/
│   └── 002-ollama-polish/
├── dist/                   # Build output (git-ignored)
│   └── cli.mjs            # Bundled executable
├── coverage/              # Test coverage reports (git-ignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .nvmrc                 # Node.js version: v18.14.0
```

## Key Patterns

### Provider Pattern

All AI providers implement the CompletionProvider interface:

```typescript
interface CompletionOptions {
  model?: string;
  apiKey?: string;
  endpoint?: string;
}

interface CompletionProvider {
  generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage>;
  validateConfig(options: CompletionOptions): void;
}
```

All providers convert their native streaming formats to a common SSE format compatible with the OpenAI response structure for unified stream processing.

### Configuration Management

Configuration stored in INI format at ~/.ai-shell:

```typescript
const config = await getConfig();
// Returns typed ValidConfig object with defaults applied

await setConfigs([['PROVIDER', 'gemini']]);
// Validates via configParsers and persists to INI file
```

### Error Handling

Use KnownError for user-facing errors:

```typescript
import { KnownError, handleCliError } from './helpers/error';

if (!isValid) {
  throw new KnownError(i18n.t('Invalid input'));
}

// In CLI handlers
try {
  await operation();
} catch (error) {
  handleCliError(error);
  process.exit(1);
}
```

## Configuration Variables

Stored in ~/.ai-shell INI file:

```ini
# Provider selection (default: gemini)
PROVIDER=gemini  # Options: gemini, openai, ollama

# API Keys
GEMINI_KEY=your_key_here
OPENAI_KEY=your_key_here

# Provider-specific settings
OLLAMA_HOST=http://localhost:11434
OPENAI_API_ENDPOINT=https://api.openai.com/v1

# Application settings
MODEL=gpt-4o-mini
SILENT_MODE=false
```

### Default Models by Provider

- **Gemini**: gemini-3-flash-preview
- **OpenAI**: gpt-4o-mini
- **Ollama**: qwen2.5-coder:14b

## CLI Commands

### Main Usage

The `lan2cli` command is available globally (via `npm link`) and can be run from any directory:

```bash
lan2cli <prompt>              # Single-prompt mode
lan2cli chat                  # Interactive chat mode
lan2cli config                # Interactive config UI
lan2cli config set KEY=VALUE  # Set config value
lan2cli config get KEY        # Get config value
lan2cli update                # Update to latest version
```

### Command Flags

```bash
-p, --prompt <text>      # Specify prompt directly
-s, --silent             # Skip explanation output
```

## Testing Strategy

### Test Types

- Unit tests (vitest): Provider logic, config management, utilities
- Integration tests: Provider switching, end-to-end Ollama workflow

### Running Tests

```bash
npm test              # Run all tests with vitest
npm run typecheck     # TypeScript validation
```

### Test Coverage

Coverage reports generated in `coverage/` directory with multiple formats:

- HTML report: `coverage/index.html`
- Clover XML: `coverage/clover.xml`
- JSON: `coverage/coverage-final.json`

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`
- Never commit to main directly
- PRs require review
- All tests must pass before merge
- Current branch: 004-remove-i18n

## Active Technologies

### Core Dependencies

- **TypeScript 4.9.5** - Type system
- **Node.js 18.14.0** - Runtime (specified in .nvmrc)
- **cleye 1.3.2** - CLI argument parsing
- **@clack/prompts** - Interactive CLI prompts
- **axios 1.3.5** - HTTP client (used by Ollama provider)
- **ini 4.0.0** - Config file parsing
- **execa 7.1.1** - Process execution
- **kolorist 1.7.0** - Terminal colors
- **dedent 0.7.0** - Template literal formatting
- **clipboardy 2.3.0** - Clipboard access
- **@nexssp/os 2.0.35** - OS detection

### AI Providers

- **@google/generative-ai 0.24.1** - Gemini provider (uses generateContentStream)
- **openai 6.17.0** - OpenAI provider (uses chat.completions.create with stream)
- **axios** - Ollama provider (custom HTTP implementation)

### Development

- **vitest 3.2.4** - Test framework
- **@vitest/coverage-v8 3.2.4** - Code coverage
- **pkgroll 2.22.0** - Build tool (bundles to ESM)
- **ESLint 8.38.0** - Linting with @typescript-eslint
- **Prettier 2.8.8** - Code formatting
- **jiti 1.17.0** - TypeScript execution for development

## Build and Distribution

### Build Commands

```bash
npm run build         # Bundle with pkgroll to dist/cli.mjs (required for global lan2cli)
npm run lint          # Check code quality (prettier + eslint)
npm run lint:fix      # Auto-fix linting issues
npm run typecheck     # TypeScript type checking
npm start             # Run from source with jiti (no build required)
```

**Note:** After `npm run build`, the global `lan2cli` command automatically uses the updated `dist/cli.mjs` via the npm link symlink.

### Build Output

- **dist/cli.mjs** - Single bundled ESM executable (~86KB)
- Binary command: `lan2cli` (configured in package.json bin field)

### Release Process

```bash
npm run release:patch  # Build, bump version, publish, push tags
```

### Package Distribution

- Package name: `@builder.io/ai-shell`
- Version: 1.0.12
- Files included: `dist/` directory only

## Development Setup

### Global Command Access

The project uses `npm link` to make the `lan2cli` command available globally during development:

```bash
# Initial setup (already done)
npm link

# Verify global access
which lan2cli  # Should show: ~/.nvm/versions/node/v*/bin/lan2cli
lan2cli --help # Works from any directory
```

**How it works:**
- Creates symlink in npm's global `node_modules` pointing to project directory
- Creates symlink in npm's global `bin` pointing to `dist/cli.mjs`
- Makes `lan2cli` available in PATH from any directory
- Changes are automatically reflected after rebuild (symlink points to project)

### Development Workflows

**Testing Built Version (Recommended for final verification):**
```bash
npm run build      # Rebuild dist/cli.mjs
lan2cli <command>  # Test globally (uses symlinked dist/cli.mjs)
```

**Fast Development Iteration (No build required):**
```bash
npm start -- <command>  # Run directly from source with jiti
```

**Example workflows:**
```bash
# Test a specific prompt globally
npm run build
lan2cli "list all log files"

# Quick development cycle (no build)
npm start -- "list all log files"

# Test chat mode globally
lan2cli chat

# Test config UI globally
lan2cli config
```

### Unlinking (If Needed)

To remove global command access:
```bash
npm unlink                        # From project directory
# Or
npm unlink -g @builder.io/ai-shell  # From anywhere
```

**Note:** When switching Node.js versions with nvm, re-run `npm link` after switching.

## Architecture Principles

### Provider Abstraction

- All AI providers implement CompletionProvider interface
- Factory pattern via createProvider() for provider instantiation
- Validation separated from completion logic
- Stream-based responses converted to unified SSE format
- Model compatibility warnings when using wrong model for provider

### Configuration Strategy

- Single source of truth: ~/.ai-shell INI file
- Type-safe parsing with configParsers (validates and applies defaults)
- Validation at parse time (e.g., isValidOllamaHost for URL validation)
- Support for provider-specific settings

### Error Handling

- KnownError for expected user-facing errors
- handleCliError for consistent error display with stack traces
- Validation errors throw immediately
- Provider errors wrapped with context and i18n support
- Ollama-specific error handling for connection issues

## User Interaction Flow

### Single-Prompt Mode

1. User runs: `lan2cli list all log files`
2. System detects provider from config (default: gemini)
3. System generates shell command via AI provider
4. System shows command + explanation (unless silent mode)
5. User chooses: Run / Edit / Revise / Copy / Cancel
6. If Run: Execute command and append to shell history
7. If Edit: Allow inline editing before running
8. If Revise: Get revision prompt and regenerate

### Interactive Chat Mode

1. User runs: `lan2cli chat`
2. System prompts for message
3. Generate and show AI response
4. User can continue conversation with context
5. Exit with 'exit' command or Ctrl+C

### Config Flow

1. User runs: `lan2cli config`
2. Interactive menu shows current values (obfuscated keys)
3. Select setting to change
4. Validate input via configParsers
5. Persist to ~/.ai-shell
6. Return to menu (recursive until cancel)

## Adding a New Provider

1. Create src/helpers/providers/newprovider.ts
2. Implement CompletionProvider interface:
   - validateConfig(): Check required options
   - generateCompletion(): Return IncomingMessage-compatible stream
3. Convert provider's native stream format to SSE format
4. Add to createProvider() factory in index.ts
5. Add config parser in src/helpers/config.ts (if new config keys needed)
6. Update showConfigUI() for configuration options
7. Add unit tests in tests/unit/providers/
8. Update PROVIDER validation list in configParsers

## Common Utilities

### Stream Handling

- `streamToIterable()` - Convert IncomingMessage to async generator yielding data lines
- `readData()` - Process stream chunks, strip code block markers, handle keypress interrupts

### Shell Integration

- `appendToShellHistory()` - Add commands to shell history (bash, zsh, fish support)
- `detectShell()` - OS and shell detection for prompt generation

### Validation

- `isValidOllamaHost()` - URL validation for Ollama (http/https only)
- Config parsers with type coercion and defaults
- Provider-specific validateConfig() methods

## Recent Changes

### Current: Global Command Setup

- Enabled global `lan2cli` command access using `npm link`
- Command now available from any directory in terminal
- Symlink points to `dist/cli.mjs` in project directory
- Documented development workflows in CLAUDE.md
- No code changes required (package already configured correctly)

### Branch: 004-remove-i18n

- Removed i18n (internationalization) feature
- Replaced all i18n.t() calls with hardcoded English strings
- Deleted i18n module and 16 locale files
- Removed LANGUAGE configuration option
- Removed i18next dependency

### Previous: 003-npm-start-enhancement

- Refactored providers to remove OpenAI-specific dependencies
- Generalized provider interface for cleaner abstraction
- Updated constants for project naming

### Previous: 002-ollama-polish

- Added Ollama provider with local model support
- Implemented OLLAMA_HOST configuration with URL validation
- Enhanced provider architecture with CompletionProvider interface
- Added comprehensive test coverage for Ollama integration
- Improved config validation and error handling

### Previous: 001-multi-provider-support

- Implemented multi-provider architecture (Gemini, OpenAI, Ollama)
- Added provider factory pattern
- Created unified stream format across providers
