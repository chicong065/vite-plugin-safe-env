import type { TaintedModule } from '#types'

const taintedModuleStore = new Map<string, TaintedModule>()

/**
 * Registers a module as tainted, meaning it contains one or more accesses
 * to server-only environment variables. If the module was previously registered,
 * the existing record is replaced with the new one.
 *
 * @param taintedModule - The tainted module record to store.
 */
export function registerTaintedModule(taintedModule: TaintedModule): void {
  taintedModuleStore.set(taintedModule.moduleId, taintedModule)
}

/**
 * Retrieves a tainted module record by its absolute file path.
 *
 * @param moduleId - The absolute file path of the module to look up.
 * @returns The tainted module record, or `undefined` if the module is not registered.
 */
export function getTaintedModule(moduleId: string): TaintedModule | undefined {
  return taintedModuleStore.get(moduleId)
}

/**
 * Returns all currently registered tainted modules as an array.
 *
 * @returns An array containing every tainted module record in the registry.
 */
export function getAllTaintedModules(): TaintedModule[] {
  return Array.from(taintedModuleStore.values())
}

/**
 * Removes a single module from the tainted registry.
 * Used during HMR when a file is updated and must be re-evaluated from scratch.
 *
 * @param moduleId - The absolute file path of the module to remove.
 */
export function clearTaintedModule(moduleId: string): void {
  taintedModuleStore.delete(moduleId)
}

/**
 * Removes all modules from the tainted registry.
 * Called at the start of each build to ensure state does not carry over
 * from a previous run.
 */
export function clearAllTaintedModules(): void {
  taintedModuleStore.clear()
}

/**
 * Returns whether at least one tainted module is currently registered.
 *
 * @returns `true` if the registry contains one or more tainted modules.
 */
export function hasTaintedModules(): boolean {
  return taintedModuleStore.size > 0
}
