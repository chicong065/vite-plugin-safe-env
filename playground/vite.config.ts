import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import safeEnv from 'vite-plugin-safe-env'

export default defineConfig(({ mode }) => {
  // Load every env var (no prefix filter) and inline it as `process.env`.
  // This is intentionally leaky so the playground reproduces the bug
  // that vite-plugin-safe-env is designed to catch.
  const processEnv = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      'process.env': JSON.stringify(processEnv),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [safeEnv({ blockOn: 'always' })],
  }
})
