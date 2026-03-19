# lan2cli / AI Shell — Project Overview

**Purpose:** CLI tool that converts natural language to shell commands using AI providers.
- Package: `@builder.io/ai-shell` v1.0.12
- Binary: `lan2cli` (global via `npm link`)
- Runtime: Node.js v18.14.0 (ESM)

**Modes:**
- Single-prompt: `lan2cli <natural language>`
- Interactive chat: `lan2cli chat`
- Config management: `lan2cli config`
- Self-update: `lan2cli update`

**AI Providers:** Gemini (default), OpenAI, Ollama (local)

**Config file:** `~/.ai-shell` (INI format)
