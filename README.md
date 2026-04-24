# vite-plugin-safe-env

A Vite plugin that prevents server-only environment variables from leaking into client-side bundles.

Vite ensures only `VITE_`-prefixed variables are exposed through `import.meta.env`, but offers no such protection for `process.env`. A server-side module accidentally imported into the client entry tree can silently inline credentials like `DATABASE_URL` or `JWT_SECRET` into the production bundle, readable by anyone who downloads the JavaScript file.

`vite-plugin-safe-env` catches this class of bug through two detection phases:

**Phase 1 (Static analysis):** Scans every source module for `process.env.X` and `import.meta.env.X` accesses, walks the module graph to find which of them are reachable from client entry points, and reports violations with the exact file, line, and import chain.

**Phase 2 (Bundle scan):** After the bundle is produced, scans every output chunk for the literal string values of known server-only variables. This is the ground-truth gate. If a secret's value appears in the output, the build fails.

## Why this matters

The risk is documented and has affected real production systems.

**[Sprocket Security (2024)](https://www.sprocketsecurity.com/blog/hunting-secrets-in-javascript-at-scale-how-a-vite-misconfiguration-lead-to-full-ci-cd-compromise):** AWS credentials and CircleCI API keys were found as plain strings in a production Vite bundle. A server-side module had been accidentally imported from the client entry tree. The exposed keys granted full access to the CI/CD pipeline, all stored secrets, and every connected repository.

**[Vite issue #17710](https://github.com/vitejs/vite/issues/17710):** Confirmed bug where referencing a non-existent env variable causes Vite to inline the **entire** `process.env` object into the client bundle, exposing every secret available in the build environment.

## Installation

```bash
npm install -D vite-plugin-safe-env
```

```bash
pnpm add -D vite-plugin-safe-env
```

```bash
yarn add -D vite-plugin-safe-env
```

## Usage

Zero configuration required.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import safeEnv from 'vite-plugin-safe-env'

export default defineConfig({
  plugins: [safeEnv()],
})
```

## How it works

### What gets flagged

Any environment variable accessed without the `VITE_` prefix that is reachable from a client entry point:

```ts
// leaking-usage.ts (imported from a client entry)
export const dbUrl = process.env.DATABASE_URL // flagged
export const apiUrl = import.meta.env.VITE_API_URL // safe, has VITE_ prefix
```

### Error output

```
[vite-plugin-safe-env] Server-only environment variable may leak to client bundle

  Variable    DATABASE_URL
  File        src/utils/db.ts:3

  Reachable via
              src/main.tsx
              src/components/UserCard.tsx
              src/utils/db.ts

  Risk
  The value of DATABASE_URL will be visible in your production
  JavaScript bundle to anyone who opens browser DevTools.

  Fix
  DATABASE_URL appears to be a credential. Exposing it in the client bundle
  is a security vulnerability. Move all access into a server-only module that
  is never imported from a client entry point.
```

In development mode, violations appear as a browser overlay using the same style as Vite's built-in TypeScript error overlay.

### Known limitation

Phase 1 only detects named accesses like `process.env.DATABASE_URL`. Computed names like `process.env[key]` are invisible to static analysis. Phase 2 compensates by scanning the compiled bundle for the actual string values of server variables.

## Configuration

All options are optional. The plugin is non-intrusive by default.

```ts
safeEnv({
  // Variables explicitly permitted on the client side, even without the VITE_ prefix.
  // Default: []
  allowClientAccess: ['NODE_ENV', 'BUILD_SHA'],

  // When to abort the build on a detected leak.
  // 'production' aborts only when NODE_ENV is production (default)
  // 'always'     aborts on every build
  // 'never'      reports violations but never aborts
  blockOn: 'production',

  // Glob patterns for source files to scan.
  // Default: ['**/*.{ts,tsx,js,jsx,vue,svelte}']
  include: ['src/**/*.ts'],

  // Glob patterns for source files to skip. Takes precedence over include.
  // Default: ['node_modules/**', 'dist/**']
  exclude: ['src/generated/**'],

  // Show the browser overlay in development mode.
  // Default: true
  overlay: true,
})
```

## Examples

### Allow specific non-prefixed variables

Some projects use variables like `NODE_ENV` or `CI` on the client intentionally:

```ts
safeEnv({
  allowClientAccess: ['NODE_ENV', 'CI', 'BUILD_TIMESTAMP'],
})
```

### Strict mode

Fails the build regardless of environment. Useful in CI pipelines that run against staging:

```ts
safeEnv({ blockOn: 'always' })
```

### Warning-only mode for gradual adoption

Reports all violations to the terminal without blocking the build. Useful when adding the plugin to an existing codebase with many violations:

```ts
safeEnv({ blockOn: 'never' })
```

## Compatibility

| Vite    | Node.js |
| ------- | ------- |
| 4, 5, 6 | 18+     |

Works with React, Vue, Svelte, Solid, and vanilla Vite projects.

## License

`vite-plugin-safe-env` is open-source software licensed under the [MIT License](./LICENSE).
