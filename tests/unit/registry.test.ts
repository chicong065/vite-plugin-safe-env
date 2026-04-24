import { describe, expect, it, beforeEach } from 'vitest'

import {
  registerTaintedModule,
  getTaintedModule,
  getAllTaintedModules,
  clearTaintedModule,
  clearAllTaintedModules,
  hasTaintedModules,
} from '#registry'

beforeEach(() => {
  clearAllTaintedModules()
})

describe('registerTaintedModule', () => {
  it('stores a tainted module in the registry', () => {
    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'DATABASE_URL', line: 3, column: 14 }],
    })

    expect(hasTaintedModules()).toBe(true)
  })

  it('overwrites an existing record when the same moduleId is registered again', () => {
    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'DATABASE_URL', line: 3, column: 14 }],
    })

    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'NEW_VAR', line: 7, column: 2 }],
    })

    const result = getTaintedModule('/project/src/utils/db.ts')
    expect(getAllTaintedModules()).toHaveLength(1)
    expect(result!.accesses[0].envVarName).toBe('NEW_VAR')
  })
})

describe('getTaintedModule', () => {
  it('returns the module when it has been registered', () => {
    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'DATABASE_URL', line: 3, column: 14 }],
    })

    const result = getTaintedModule('/project/src/utils/db.ts')

    expect(result).toBeDefined()
    expect(result!.accesses[0].envVarName).toBe('DATABASE_URL')
  })

  it('returns undefined for a module that has not been registered', () => {
    const result = getTaintedModule('/project/src/utils/clean.ts')

    expect(result).toBeUndefined()
  })
})

describe('getAllTaintedModules', () => {
  it('returns all registered tainted modules', () => {
    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'DATABASE_URL', line: 1, column: 1 }],
    })
    registerTaintedModule({
      moduleId: '/project/src/utils/auth.ts',
      accesses: [{ envVarName: 'JWT_SECRET', line: 2, column: 1 }],
    })

    const result = getAllTaintedModules()

    expect(result).toHaveLength(2)
  })

  it('returns an empty array when the registry is empty', () => {
    expect(getAllTaintedModules()).toHaveLength(0)
  })
})

describe('clearTaintedModule', () => {
  it('removes a specific module from the registry', () => {
    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'DATABASE_URL', line: 1, column: 1 }],
    })

    clearTaintedModule('/project/src/utils/db.ts')

    expect(getTaintedModule('/project/src/utils/db.ts')).toBeUndefined()
  })

  it('does not throw when removing a module that was never registered', () => {
    expect(() => clearTaintedModule('/project/src/utils/never-registered.ts')).not.toThrow()
  })
})

describe('clearAllTaintedModules', () => {
  it('removes all modules from the registry', () => {
    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'DATABASE_URL', line: 1, column: 1 }],
    })
    registerTaintedModule({
      moduleId: '/project/src/utils/auth.ts',
      accesses: [{ envVarName: 'JWT_SECRET', line: 1, column: 1 }],
    })

    clearAllTaintedModules()

    expect(hasTaintedModules()).toBe(false)
    expect(getAllTaintedModules()).toHaveLength(0)
  })
})

describe('hasTaintedModules', () => {
  it('returns false when the registry is empty', () => {
    expect(hasTaintedModules()).toBe(false)
  })

  it('returns true after a module is registered', () => {
    registerTaintedModule({
      moduleId: '/project/src/utils/db.ts',
      accesses: [{ envVarName: 'DATABASE_URL', line: 1, column: 1 }],
    })

    expect(hasTaintedModules()).toBe(true)
  })
})
