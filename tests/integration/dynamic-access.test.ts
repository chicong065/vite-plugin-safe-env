import { describe, expect, it } from 'vitest'

import { scanModuleSource } from '#scanner'

describe('dynamic env access (known limitation)', () => {
  it('does not detect dynamic process.env bracket access in Phase 1 static analysis', () => {
    const sourceCodeWithDynamicAccess = `
      const envKey = 'DATABASE_URL'
      const value = process.env[envKey]
    `

    const result = scanModuleSource(sourceCodeWithDynamicAccess, new Set<string>())

    expect(result).toHaveLength(0)
  })
})
