# Development Guide

## Prerequisites

- Node.js >= 20
- npm (included with Node.js)

## Setup

```bash
npm install
```

## Scripts

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `npm run build`      | Build ESM + CJS + type declarations with tsup  |
| `npm run dev`        | Build in watch mode                            |
| `npm test`           | Run tests with node:test via tsx                |
| `npm run lint`       | Lint with ESLint                               |
| `npm run lint:fix`   | Lint and auto-fix                              |
| `npm run format`     | Format with Prettier                           |
| `npm run format:check` | Check formatting without writing            |
| `npm run typecheck`  | Type-check with tsc (no emit)                  |
| `npm run check`      | Run typecheck + lint + format:check + test     |

## Project Structure

```
src/           TypeScript source files
test/          Test files (*.test.ts)
dist/          Build output (git-ignored)
docs/          Specification and design documents
```

## Testing

Tests use Node.js built-in `node:test` runner with `tsx` for TypeScript support:

```bash
npm test
```

Test files live in `test/` and follow the `*.test.ts` naming convention. Use `describe`/`it` from `node:test` and assertions from `node:assert/strict`.

## Building

```bash
npm run build
```

Produces dual ESM (`dist/index.js`) and CJS (`dist/index.cjs`) bundles with TypeScript declarations (`dist/index.d.ts`, `dist/index.d.cts`) and source maps.

## Code Quality

Run all checks before committing:

```bash
npm run check
```

This runs typecheck, lint, format check, and tests in sequence. The same check runs as part of `prepublishOnly`.
