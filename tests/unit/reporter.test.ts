import { describe, expect, it } from 'vitest'

import {
  buildSuggestedFix,
  formatViolationForTerminal,
  formatBundleLeakForTerminal,
  formatViolationForOverlay,
} from '#reporter'

const exampleViolation = {
  moduleId: '/project/src/utils/db.ts',
  envVarName: 'DATABASE_URL',
  line: 14,
  column: 18,
  importChain: ['/project/src/main.tsx', '/project/src/components/UserCard.tsx', '/project/src/utils/db.ts'],
  suggestedFix: 'Move all database access into a server-only module.',
}

const exampleBundleLeak = {
  chunkFileName: 'index-Bx3k9.js',
  envVarName: 'DATABASE_URL',
  originalFile: '/project/src/utils/db.ts',
  originalLine: 14,
  originalColumn: 18,
}

describe('buildSuggestedFix', () => {
  it('generates a credential warning for a variable containing SECRET', () => {
    const result = buildSuggestedFix('JWT_SECRET', ['/project/src/main.tsx'])

    expect(result.toLowerCase()).toContain('credential')
  })

  it('generates a credential warning for a variable containing TOKEN', () => {
    const result = buildSuggestedFix('AUTH_TOKEN', ['/project/src/main.tsx'])

    expect(result.toLowerCase()).toContain('credential')
  })

  it('generates a credential warning for a variable containing KEY', () => {
    const result = buildSuggestedFix('API_KEY', ['/project/src/main.tsx'])

    expect(result.toLowerCase()).toContain('credential')
  })

  it('generates a server module suggestion for a variable containing URL', () => {
    const result = buildSuggestedFix('DATABASE_URL', ['/project/src/main.tsx'])

    expect(result.toLowerCase()).toContain('server')
  })

  it('generates an import structure fix when the chain passes through a server file', () => {
    const result = buildSuggestedFix('MY_CUSTOM_VAR', ['/project/src/main.tsx', '/project/src/server/db.ts'])

    expect(result.toLowerCase()).toContain('import')
  })

  it('generates a generic fix for a variable with no recognised keyword', () => {
    const result = buildSuggestedFix('MY_CUSTOM_VAR', ['/project/src/main.tsx'])

    expect(result).toContain('MY_CUSTOM_VAR')
  })

  it('does not classify a variable as a credential when the keyword appears only as a substring', () => {
    const result = buildSuggestedFix('HOCKEY_ENABLED', ['/project/src/main.tsx'])

    expect(result.toLowerCase()).not.toContain('credential')
  })
})

describe('formatViolationForTerminal', () => {
  it('includes the variable name in the output', () => {
    const result = formatViolationForTerminal(exampleViolation)

    expect(result).toContain('DATABASE_URL')
  })

  it('includes the file path in the output', () => {
    const result = formatViolationForTerminal(exampleViolation)

    expect(result).toContain('/project/src/utils/db.ts')
  })

  it('includes the line number in the output', () => {
    const result = formatViolationForTerminal(exampleViolation)

    expect(result).toContain('14')
  })

  it('includes each module in the import chain', () => {
    const result = formatViolationForTerminal(exampleViolation)

    expect(result).toContain('/project/src/main.tsx')
    expect(result).toContain('/project/src/components/UserCard.tsx')
  })

  it('includes the suggested fix', () => {
    const result = formatViolationForTerminal(exampleViolation)

    expect(result).toContain(exampleViolation.suggestedFix)
  })
})

describe('formatBundleLeakForTerminal', () => {
  it('includes the variable name in the output', () => {
    const result = formatBundleLeakForTerminal(exampleBundleLeak)

    expect(result).toContain('DATABASE_URL')
  })

  it('includes the chunk file name in the output', () => {
    const result = formatBundleLeakForTerminal(exampleBundleLeak)

    expect(result).toContain('index-Bx3k9.js')
  })

  it('includes the original source file in the output', () => {
    const result = formatBundleLeakForTerminal(exampleBundleLeak)

    expect(result).toContain('/project/src/utils/db.ts')
  })
})

describe('formatViolationForOverlay', () => {
  it('returns an object with type set to error', () => {
    const result = formatViolationForOverlay(exampleViolation)

    expect(result.type).toBe('error')
  })

  it('includes the plugin name', () => {
    const result = formatViolationForOverlay(exampleViolation)

    expect(result.err.plugin).toBe('vite-plugin-safe-env')
  })

  it('includes the variable name in the error message', () => {
    const result = formatViolationForOverlay(exampleViolation)

    expect(result.err.message).toContain('DATABASE_URL')
  })

  it('includes the file path and line number in the stack', () => {
    const result = formatViolationForOverlay(exampleViolation)

    expect(result.err.stack).toContain('/project/src/utils/db.ts')
    expect(result.err.stack).toContain('14')
  })
})
