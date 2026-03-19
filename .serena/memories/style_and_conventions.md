# Code Style and Conventions

## Language & Tooling
- TypeScript 4.9.5, ESM modules (`"type": "module"`)
- Prettier 2.8.8 + ESLint 8 with @typescript-eslint
- Config: `.prettierrc.json`, `.eslintrc.cjs`

## Critical Rules
- **Immutability always**: never mutate objects/arrays; use spread (`{...obj, key: val}`)
- **No emojis** in code, comments, or docs
- **KnownError** for user-facing errors; `handleCliError()` in CLI handlers
- **Input validation** for all user inputs
- No hardcoded secrets; config via `~/.ai-shell` INI file

## File Organization
- Many small focused files (200–400 lines typical, 800 max)
- Organize by feature/domain, not by type
- High cohesion, low coupling

## Naming
- camelCase functions/variables
- PascalCase interfaces/types
- Constants in UPPER_SNAKE_CASE (config keys)

## Error Handling Pattern
```typescript
import { KnownError, handleCliError } from './helpers/error';
throw new KnownError('User-facing message');
// In CLI handlers:
try { await op(); } catch (e) { handleCliError(e); process.exit(1); }
```

## Commit Messages (Conventional Commits)
Types: feat, fix, refactor, docs, test, chore, perf, ci
