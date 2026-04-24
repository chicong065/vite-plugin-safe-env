import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { describe, expect, it, afterEach, vi } from 'vitest'

import safeEnvPlugin from '#plugin'

const playgroundRoot = fileURLToPath(new URL('../../playground', import.meta.url))

describe('leaking module', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('aborts the build when a server env var is accessible from the client entry', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:secret@localhost/db')
    vi.stubEnv('NODE_ENV', 'production')

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
