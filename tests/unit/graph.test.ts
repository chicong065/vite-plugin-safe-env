import { describe, expect, it } from 'vitest'

import { collectClientReachableModuleIds, buildImportChainToModule, buildImportChainViaImporters } from '#graph'

const moduleImportFixture: Record<string, string[]> = {
  '/src/main.tsx': ['/src/components/UserCard.tsx', '/src/utils/clean.ts'],
  '/src/components/UserCard.tsx': ['/src/utils/db.ts', '/src/utils/format.ts'],
  '/src/utils/db.ts': [],
  '/src/utils/format.ts': [],
  '/src/utils/clean.ts': [],
  '/src/server/handler.ts': ['/src/utils/db.ts'],
}

const getImportedModuleIds = (moduleId: string): string[] => moduleImportFixture[moduleId] ?? []

describe('collectClientReachableModuleIds', () => {
  it('includes the entry point itself in the reachable set', () => {
    const result = collectClientReachableModuleIds(['/src/main.tsx'], getImportedModuleIds)

    expect(result.has('/src/main.tsx')).toBe(true)
  })

  it('includes transitively imported modules', () => {
    const result = collectClientReachableModuleIds(['/src/main.tsx'], getImportedModuleIds)

    expect(result.has('/src/utils/db.ts')).toBe(true)
  })

  it('does not include modules unreachable from the entry point', () => {
    const result = collectClientReachableModuleIds(['/src/main.tsx'], getImportedModuleIds)

    expect(result.has('/src/server/handler.ts')).toBe(false)
  })

  it('handles circular imports without infinite loops', () => {
    const circularModuleMap: Record<string, string[]> = {
      '/src/moduleA.ts': ['/src/moduleB.ts'],
      '/src/moduleB.ts': ['/src/moduleA.ts'],
    }

    const result = collectClientReachableModuleIds(['/src/moduleA.ts'], (moduleId) => circularModuleMap[moduleId] ?? [])

    expect(result.has('/src/moduleA.ts')).toBe(true)
    expect(result.has('/src/moduleB.ts')).toBe(true)
  })

  it('accepts multiple entry points and merges their reachable sets', () => {
    const result = collectClientReachableModuleIds(['/src/main.tsx', '/src/server/handler.ts'], getImportedModuleIds)

    expect(result.has('/src/utils/db.ts')).toBe(true)
    expect(result.has('/src/server/handler.ts')).toBe(true)
  })

  it('returns an empty set when no entry points are provided', () => {
    const result = collectClientReachableModuleIds([], getImportedModuleIds)

    expect(result.size).toBe(0)
  })
})

describe('buildImportChainToModule', () => {
  it('returns the shortest path from an entry point to the target module', () => {
    const result = buildImportChainToModule('/src/utils/db.ts', ['/src/main.tsx'], getImportedModuleIds)

    expect(result).toEqual(['/src/main.tsx', '/src/components/UserCard.tsx', '/src/utils/db.ts'])
  })

  it('returns a single-element array when the target is the entry point itself', () => {
    const result = buildImportChainToModule('/src/main.tsx', ['/src/main.tsx'], getImportedModuleIds)

    expect(result).toEqual(['/src/main.tsx'])
  })

  it('returns the target as a fallback when no chain can be found', () => {
    const result = buildImportChainToModule('/src/unreachable/module.ts', ['/src/main.tsx'], getImportedModuleIds)

    expect(result).toEqual(['/src/unreachable/module.ts'])
  })

  it('returns the target as a fallback when the entry points array is empty', () => {
    const result = buildImportChainToModule('/src/utils/db.ts', [], getImportedModuleIds)

    expect(result).toEqual(['/src/utils/db.ts'])
  })

  it('returns the shortest path when the target is reachable via multiple routes', () => {
    const diamondModuleMap: Record<string, string[]> = {
      '/src/entry.ts': ['/src/pathA.ts', '/src/pathB.ts'],
      '/src/pathA.ts': ['/src/target.ts'],
      '/src/pathB.ts': ['/src/target.ts'],
      '/src/target.ts': [],
    }

    const result = buildImportChainToModule(
      '/src/target.ts',
      ['/src/entry.ts'],
      (moduleId) => diamondModuleMap[moduleId] ?? []
    )

    expect(result).toHaveLength(3)
    expect(result[0]).toBe('/src/entry.ts')
    expect(result[result.length - 1]).toBe('/src/target.ts')
  })
})

describe('buildImportChainViaImporters', () => {
  const importerFixture: Record<string, string[]> = {
    '/src/utils/db.ts': ['/src/components/UserCard.tsx'],
    '/src/components/UserCard.tsx': ['/src/main.tsx'],
    '/src/main.tsx': [],
  }

  const getImporterModuleIds = (moduleId: string): string[] => importerFixture[moduleId] ?? []

  it('returns the full chain from the root down to the target', () => {
    const result = buildImportChainViaImporters('/src/utils/db.ts', getImporterModuleIds)

    expect(result).toEqual(['/src/main.tsx', '/src/components/UserCard.tsx', '/src/utils/db.ts'])
  })

  it('returns a chain of length two when the target has exactly one importer that is itself a root', () => {
    const result = buildImportChainViaImporters('/src/components/UserCard.tsx', getImporterModuleIds)

    expect(result).toEqual(['/src/main.tsx', '/src/components/UserCard.tsx'])
  })

  it('returns a single-element array when the target has no importers (is itself a root)', () => {
    const result = buildImportChainViaImporters('/src/main.tsx', getImporterModuleIds)

    expect(result).toEqual(['/src/main.tsx'])
  })

  it('returns a single-element array as a fallback when no root is reachable (cycle)', () => {
    const cyclicImporterMap: Record<string, string[]> = {
      '/src/moduleA.ts': ['/src/moduleB.ts'],
      '/src/moduleB.ts': ['/src/moduleA.ts'],
    }

    const result = buildImportChainViaImporters(
      '/src/moduleA.ts',
      (moduleId) => cyclicImporterMap[moduleId] ?? []
    )

    expect(result).toEqual(['/src/moduleA.ts'])
  })

  it('returns the shortest chain when the target has multiple importer routes', () => {
    const diamondImporterMap: Record<string, string[]> = {
      '/src/target.ts': ['/src/branchA.ts', '/src/branchB.ts'],
      '/src/branchA.ts': ['/src/middle.ts'],
      '/src/branchB.ts': ['/src/root.ts'],
      '/src/middle.ts': ['/src/root.ts'],
      '/src/root.ts': [],
    }

    const result = buildImportChainViaImporters('/src/target.ts', (moduleId) => diamondImporterMap[moduleId] ?? [])

    expect(result[0]).toBe('/src/root.ts')
    expect(result[result.length - 1]).toBe('/src/target.ts')
    expect(result).toHaveLength(3)
    expect(result).toEqual(['/src/root.ts', '/src/branchB.ts', '/src/target.ts'])
  })

  it('returns the target alone when the importer adapter returns an empty array for every module', () => {
    const result = buildImportChainViaImporters('/src/isolated.ts', () => [])

    expect(result).toEqual(['/src/isolated.ts'])
  })
})
