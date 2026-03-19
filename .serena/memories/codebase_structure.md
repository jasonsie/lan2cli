# Codebase Structure

```
src/
  cli.ts                        # Entry point; cleye CLI parsing, command routing
  prompt.ts                     # Main interaction flow (generate, run/revise/copy)
  commands/
    chat.ts                     # Interactive multi-turn chat mode
    config.ts                   # Config UI (interactive menu)
    update.ts                   # Self-update command
  helpers/
    config.ts                   # INI config read/write; configParsers; showConfigUI
    completion.ts               # Provider-agnostic stream orchestration; readData()
    error.ts                    # KnownError class; handleCliError()
    constants.ts                # commandName, projectName
    os-detect.ts                # Shell & OS detection
    shell-history.ts            # Append commands to bash/zsh/fish history
    stream-to-iterable.ts       # IncomingMessage -> async iterable
    strip-regex-patterns.ts     # Clean code-block markers from output
    providers/
      types.ts                  # CompletionOptions & CompletionProvider interfaces
      index.ts                  # createProvider() factory
      gemini.ts                 # Google Gemini provider
      openai.ts                 # OpenAI provider
      ollama.ts                 # Ollama local provider

tests/
  unit/
    config.test.ts
    providers/gemini.test.ts
    providers/ollama.test.ts
  integration/
    provider-switching.test.ts
    ollama-e2e.test.ts
  fixtures/

specs/                          # Feature specs (001-multi-provider-support, 002-ollama-polish)
dist/cli.mjs                    # Built output (git-ignored)
```

**Key interfaces:**
```typescript
interface CompletionOptions { model?: string; apiKey?: string; endpoint?: string; }
interface CompletionProvider {
  generateCompletion(prompt: string, options: CompletionOptions): Promise<IncomingMessage>;
  validateConfig(options: CompletionOptions): void;
}
```

**Provider factory:** `createProvider(providerName)` in `src/helpers/providers/index.ts`

**Config keys:** PROVIDER, GEMINI_KEY, OPENAI_KEY, OLLAMA_HOST, OPENAI_API_ENDPOINT, MODEL, SILENT_MODE
