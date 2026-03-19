# Suggested Commands

## Development
```bash
npm start -- <args>     # Run from source (no build, uses jiti)
npm run build           # Bundle to dist/cli.mjs with pkgroll
npm run typecheck       # TypeScript type checking (tsc)
npm test                # Run all tests with vitest
npm run lint            # Check formatting (prettier) + linting (eslint)
npm run lint:fix        # Auto-fix formatting and linting issues
```

## Testing the built binary
```bash
npm run build && lan2cli "list log files"
lan2cli chat
lan2cli config
```

## Release
```bash
npm run release:patch   # build + version bump + publish + push tags
```

## Global link (dev setup)
```bash
npm link                # Make lan2cli available globally
npm unlink              # Remove global access
```
