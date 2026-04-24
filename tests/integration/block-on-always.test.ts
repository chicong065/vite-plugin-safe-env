import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { describe, expect, it, afterEach, vi } from 'vitest'

import safeEnvPlugin from '#plugin'

const playgroundRoot = fileURLToPath(new URL('../../playground', import.meta.url))

describe('blockOn: always', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('aborts the build even when NODE_ENV is development', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:secret@localhost/db')
    vi.stubEnv('NODE_ENV', 'development')

    await expect(
      build({
        root: playgroundRoot,
        configFile: false,
        resolve: {
          alias: {
            '@': resolve(playgroundRoot, 'src'),
          },
        },
        plugins: [safeEnvPlugin({ blockOn: 'always' })],
        logLevel: 'silent',
        build: { write: false },
      })
    ).rejects.toThrow()
  })
})
