import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { describe, expect, it, afterEach, vi } from 'vitest'

import safeEnvPlugin from '#plugin'

const playgroundRoot = fileURLToPath(new URL('../../playground', import.meta.url))

describe('allowClientAccess option', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not flag a variable that appears in allowClientAccess', async () => {
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
        plugins: [
          safeEnvPlugin({
            blockOn: 'always',
            allowClientAccess: ['DATABASE_URL'],
          }),
        ],
        logLevel: 'silent',
        build: { write: false },
      })
    ).resolves.toBeDefined()
  })
})
