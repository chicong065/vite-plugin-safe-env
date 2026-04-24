/**
 * A callback that returns the direct imported module IDs for a given module.
 * Abstracts over both Vite's dev-mode module graph and rollup's build-mode graph,
 * allowing the graph walker to work in both contexts without coupling to either.
 *
 * @param moduleId - The absolute file path of the module to query.
 * @returns An array of absolute file paths that the given module imports directly.
 */
export type GetImportedModuleIds = (moduleId: string) => string[]

/**
 * Seeds a BFS or DFS work queue with the given entry module IDs, marking each
 * as visited to prevent duplicate processing. Entry IDs already in the visited
 * set are skipped silently.
 */
function seedWorkQueue(entryModuleIds: string[], visitedModuleIds: Set<string>, workQueue: string[]): void {
  for (const entryModuleId of entryModuleIds) {
    if (!visitedModuleIds.has(entryModuleId)) {
      visitedModuleIds.add(entryModuleId)
      workQueue.push(entryModuleId)
    }
  }
}

/**
 * Walks the module import graph starting from the given client entry points
 * using a depth-first traversal, collecting all transitively reachable module IDs.
 * Handles circular imports safely by tracking visited modules.
 *
 * @param clientEntryModuleIds - The absolute file paths of all client entry point modules.
 * @param getImportedModuleIds - Returns the direct imported module IDs for a given module ID.
 * @returns A Set containing every module ID reachable from the provided entry points.
 */
export function collectClientReachableModuleIds(
  clientEntryModuleIds: string[],
  getImportedModuleIds: GetImportedModuleIds
): Set<string> {
  const visitedModuleIds = new Set<string>()
  const modulesToVisit: string[] = []

  seedWorkQueue(clientEntryModuleIds, visitedModuleIds, modulesToVisit)

  while (modulesToVisit.length > 0) {
    const currentModuleId = modulesToVisit.pop()!

    for (const importedModuleId of getImportedModuleIds(currentModuleId)) {
      if (!visitedModuleIds.has(importedModuleId)) {
        visitedModuleIds.add(importedModuleId)
        modulesToVisit.push(importedModuleId)
      }
    }
  }

  return visitedModuleIds
}

/**
 * Finds the shortest import chain from any client entry point to the target module
 * using a breadth-first search. Returns the reconstructed path as an ordered array
 * of module IDs from the entry point to the target.
 *
 * @param targetModuleId - The module ID to trace back to a client entry point.
 * @param clientEntryModuleIds - The absolute file paths of all client entry point modules.
 * @param getImportedModuleIds - Returns the direct imported module IDs for a given module ID.
 * @returns An ordered array of module IDs forming the shortest path from an entry to the target,
 *          or a single-element array containing only the target if no chain can be found.
 */
export function buildImportChainToModule(
  targetModuleId: string,
  clientEntryModuleIds: string[],
  getImportedModuleIds: GetImportedModuleIds
): string[] {
  const parentModuleMap = new Map<string, string | null>()
  const visitedModuleIds = new Set<string>()
  const modulesToVisit: string[] = []

  seedWorkQueue(clientEntryModuleIds, visitedModuleIds, modulesToVisit)
  for (const entryModuleId of clientEntryModuleIds) {
    if (!parentModuleMap.has(entryModuleId)) {
      parentModuleMap.set(entryModuleId, null)
    }
  }

  while (modulesToVisit.length > 0) {
    const currentModuleId = modulesToVisit.shift()!

    if (currentModuleId === targetModuleId) {
      return reconstructPathFromParentMap(targetModuleId, parentModuleMap)
    }

    for (const importedModuleId of getImportedModuleIds(currentModuleId)) {
      if (!visitedModuleIds.has(importedModuleId)) {
        visitedModuleIds.add(importedModuleId)
        parentModuleMap.set(importedModuleId, currentModuleId)
        modulesToVisit.push(importedModuleId)
      }
    }
  }

  return [targetModuleId]
}

/**
 * Reconstructs the path from an entry point to a target module by walking
 * backwards through a parent map built during BFS traversal.
 */
function reconstructPathFromParentMap(targetModuleId: string, parentModuleMap: Map<string, string | null>): string[] {
  const pathSegments: string[] = []
  let currentModuleId: string | null = targetModuleId

  while (currentModuleId !== null) {
    pathSegments.unshift(currentModuleId)
    currentModuleId = parentModuleMap.get(currentModuleId) ?? null
  }

  return pathSegments
}
