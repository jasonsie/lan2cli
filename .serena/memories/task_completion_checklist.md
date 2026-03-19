# Task Completion Checklist

After completing any code change:

1. **Typecheck**: `npm run typecheck`
2. **Lint**: `npm run lint` (or `npm run lint:fix` to auto-fix)
3. **Tests**: `npm test` — must pass, aim for 80%+ coverage
4. **Build** (if shipping): `npm run build`
5. **Manual verify** (optional): `lan2cli "<some prompt>"` with built binary

## Code Quality (before marking done)
- [ ] Functions < 50 lines
- [ ] Files < 800 lines
- [ ] No `console.log` statements
- [ ] No mutation (immutable patterns)
- [ ] Proper error handling with KnownError
- [ ] No hardcoded secrets

## TDD Workflow
1. Write failing test (RED)
2. Implement minimal code (GREEN)
3. Refactor (IMPROVE)
4. Verify coverage ≥ 80%
