# Data Model: Multi-Provider Support

## Configuration Entities

The configuration is stored in `~/.ai-shell` (INI format).

### Config Schema

```typescript
type Config = {
  // Existing
  OPENAI_KEY?: string;
  OPENAI_API_ENDPOINT?: string;
  MODEL?: string; // Legacy: used for OpenAI model or general model override
  SILENT_MODE?: boolean;
  LANGUAGE?: string;

  // New
  PROVIDER?: 'openai' | 'gemini' | 'ollama'; // Default: 'gemini' for new users
  GEMINI_KEY?: string;
  GEMINI_API_ENDPOINT?: string; // Optional override
  OLLAMA_HOST?: string; // Default: 'http://localhost:11434'
};
```

## Internal Entities

### Provider Enum

```typescript
enum Provider {
  OpenAI = 'openai',
  Gemini = 'gemini',
  Ollama = 'ollama',
}
```

### Completion Request

```typescript
interface CompletionRequest {
  prompt: string;
  model?: string; // Specific model if requested
}
```
