import { describe, expect, it, afterEach, vi } from 'vitest'

import { scanOutputChunk, collectServerEnvVarValues } from '#bundle-scan'

describe('scanOutputChunk', () => {
  it('detects a leaked secret value in chunk code', () => {
    const knownSecrets = new Map([['DATABASE_URL', 'postgres://user:pass@localhost/db']])

    const result = scanOutputChunk({
      chunkCode: `const url = "postgres://user:pass@localhost/db"`,
      chunkFileName: 'index-Bx3k9.js',
      knownSecrets,
      sourceMap: null,
    })

    expect(result).toHaveLength(1)
    expect(result[0].envVarName).toBe('DATABASE_URL')
    expect(result[0].chunkFileName).toBe('index-Bx3k9.js')
  })

  it('returns an empty array when no secrets are present in the chunk', () => {
    const knownSecrets = new Map([['DATABASE_URL', 'postgres://user:pass@localhost/db']])

    const result = scanOutputChunk({
      chunkCode: `const greeting = "hello world"`,
      chunkFileName: 'index-Bx3k9.js',
      knownSecrets,
      sourceMap: null,
    })

    expect(result).toHaveLength(0)
  })

  it('skips secrets shorter than the minimum length to avoid false positives', () => {
    const knownSecrets = new Map([['SHORT_VAR', 'abc']])

    const result = scanOutputChunk({
      chunkCode: `const value = "abc"`,
      chunkFileName: 'index-Bx3k9.js',
      knownSecrets,
      sourceMap: null,
    })

    expect(result).toHaveLength(0)
  })

  it('detects multiple leaked secrets in the same chunk', () => {
    const knownSecrets = new Map([
      ['DATABASE_URL', 'postgres://localhost/db'],
      ['JWT_SECRET', 'supersecretvalue123'],
    ])

    const result = scanOutputChunk({
      chunkCode: `
        const url = "postgres://localhost/db";
        const secret = "supersecretvalue123";
      `,
      chunkFileName: 'index-Bx3k9.js',
      knownSecrets,
      sourceMap: null,
    })

    expect(result).toHaveLength(2)
  })

  it('returns unknown file and line 0 when no sourcemap is provided', () => {
    const knownSecrets = new Map([['DATABASE_URL', 'postgres://localhost/db']])

    const result = scanOutputChunk({
      chunkCode: `const url = "postgres://localhost/db"`,
      chunkFileName: 'index-Bx3k9.js',
      knownSecrets,
      sourceMap: null,
    })

    expect(result[0].originalFile).toBe('unknown')
    expect(result[0].originalLine).toBe(0)
    expect(result[0].originalColumn).toBe(0)
  })
})

describe('collectServerEnvVarValues', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('collects non-VITE_ prefixed environment variables', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/db')
    vi.stubEnv('JWT_SECRET', 'testsecret')

    const result = collectServerEnvVarValues([])

    expect(result.has('DATABASE_URL')).toBe(true)
    expect(result.has('JWT_SECRET')).toBe(true)
  })

  it('excludes VITE_ prefixed environment variables', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com')

    const result = collectServerEnvVarValues([])

    expect(result.has('VITE_API_URL')).toBe(false)
  })

  it('excludes variables listed in allowClientAccess', () => {
    vi.stubEnv('NODE_ENV', 'test')

    const result = collectServerEnvVarValues(['NODE_ENV'])

    expect(result.has('NODE_ENV')).toBe(false)
  })

  it('excludes variables with undefined values', () => {
    delete process.env['EMPTY_VAR']

    const result = collectServerEnvVarValues([])

    expect(result.has('EMPTY_VAR')).toBe(false)
  })
})
