import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/types.ts'],
    },
  },
  resolve: {
    alias: {
      '#plugin': fileURLToPath(new URL('src/index.ts', import.meta.url)),
      '#env-classification': fileURLToPath(new URL('src/env-classification.ts', import.meta.url)),
      '#scanner': fileURLToPath(new URL('src/scanner.ts', import.meta.url)),
      '#registry': fileURLToPath(new URL('src/registry.ts', import.meta.url)),
      '#graph': fileURLToPath(new URL('src/graph.ts', import.meta.url)),
      '#bundle-scan': fileURLToPath(new URL('src/bundle-scan.ts', import.meta.url)),
      '#reporter': fileURLToPath(new URL('src/reporter.ts', import.meta.url)),
      '#worker': fileURLToPath(new URL('src/worker.ts', import.meta.url)),
      '#types': fileURLToPath(new URL('src/types.ts', import.meta.url)),
    },
  },
})
