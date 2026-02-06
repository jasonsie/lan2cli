# Quickstart: Multi-Provider Verification

## Prerequisites

1. Node.js 18+ installed.
2. `npm install` run in root.
3. Build the project: `npm run build`.

## Manual Verification

### 1. Test Gemini

```bash
# Set provider to Gemini
node dist/cli.mjs config set PROVIDER=gemini
node dist/cli.mjs config set GEMINI_KEY=<your-key>

# Run a command
node dist/cli.mjs "list files in current directory"
```

### 2. Test Ollama

```bash
# Ensure Ollama is running (ollama serve)
# Pull the model first
ollama pull qwen2.5-coder:14b

# Set provider to Ollama
node dist/cli.mjs config set PROVIDER=ollama

# Run a command
node dist/cli.mjs "show disk usage"
```

### 3. Test Legacy OpenAI

```bash
# Set provider back to OpenAI
node dist/cli.mjs config set PROVIDER=openai

# Run a command
node dist/cli.mjs "whoami"
```

## Automated Tests

Run the new test suite:

```bash
npm run test
```
