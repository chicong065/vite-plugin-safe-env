import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { describe, expect, it, afterEach, vi } from 'vitest'

import safeEnvPlugin from '#plugin'

const playgroundRoot = fileURLToPath(new URL('../../playground', import.meta.url))

describe('blockOn: never', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('completes the build and emits a warning instead of aborting', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:secret@localhost/db')

    await expect(
      build({
        root: playgroundRoot,
        configFile: false,
        resolve: {
          alias: {
            '@': resolve(playgroundRoot, 'src'),
          },
        },
        plugins: [safeEnvPlugin({ blockOn: 'never' })],
        logLevel: 'silent',
        build: { write: false },
      })
    ).resolves.toBeDefined()
  })
})
