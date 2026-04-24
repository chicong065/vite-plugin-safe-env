import { describe, expect, it } from 'vitest'

import { scanModuleSource } from '#scanner'

describe('scanModuleSource', () => {
  it('detects process.env access without VITE_ prefix', () => {
    const sourceCode = `const databaseUrl = process.env.DATABASE_URL`

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result).toHaveLength(1)
    expect(result[0].envVarName).toBe('DATABASE_URL')
  })

  it('ignores process.env access with VITE_ prefix', () => {
    const sourceCode = `const apiUrl = process.env.VITE_API_URL`

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result).toHaveLength(0)
  })

  it('detects import.meta.env access without VITE_ prefix', () => {
    const sourceCode = `const secret = import.meta.env.JWT_SECRET`

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result).toHaveLength(1)
    expect(result[0].envVarName).toBe('JWT_SECRET')
  })

  it('ignores import.meta.env access with VITE_ prefix', () => {
    const sourceCode = `const key = import.meta.env.VITE_PUBLIC_KEY`

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result).toHaveLength(0)
  })

  it('ignores variables listed in allowClientAccess', () => {
    const sourceCode = `const nodeEnv = process.env.NODE_ENV`

    const result = scanModuleSource(sourceCode, new Set(['NODE_ENV']))

    expect(result).toHaveLength(0)
  })

  it('reports correct line number for a single-line file', () => {
    const sourceCode = `const url = process.env.DATABASE_URL`

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result[0].line).toBe(1)
  })

  it('reports the column of the variable name, not the accessor prefix', () => {
    const sourceCode = `const url = process.env.DATABASE_URL`

    const result = scanModuleSource(sourceCode, new Set([]))

    // 'DATABASE_URL' starts at column 25 in the string above
    // 'const url = process.env.' is 24 characters, so column is 25
    expect(result[0].column).toBe(25)
  })

  it('reports correct line and column for a multi-line file', () => {
    const sourceCode = [`import { something } from 'somewhere'`, ``, `const dbUrl = process.env.DATABASE_URL`].join(
      '\n'
    )

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result[0].line).toBe(3)
    // 'DATABASE_URL' starts at column 27 in the third line
    // 'const dbUrl = process.env.' is 26 characters, so column is 27
    expect(result[0].column).toBe(27)
  })

  it('detects multiple env var accesses in one file', () => {
    const sourceCode = [`const dbUrl = process.env.DATABASE_URL`, `const secret = import.meta.env.JWT_SECRET`].join(
      '\n'
    )

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result).toHaveLength(2)
    expect(result[0].envVarName).toBe('DATABASE_URL')
    expect(result[1].envVarName).toBe('JWT_SECRET')
  })

  it('returns an empty array for a file with no env var access', () => {
    const sourceCode = `const value = 'hello world'`

    const result = scanModuleSource(sourceCode, new Set([]))

    expect(result).toHaveLength(0)
  })
})
