import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

import safeEnv from '../dist/index.js'

const playgroundDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(playgroundDir, 'src'),
    },
  },
  plugins: [safeEnv({ blockOn: 'always' })],
})
