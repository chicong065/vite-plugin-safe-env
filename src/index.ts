import type { SourceMapInput } from '@jridgewell/trace-mapping'
import type { Plugin, ResolvedConfig } from 'vite'
import { createFilter, resolveEnvPrefix } from 'vite'

import { scanOutputChunk, collectServerEnvVarValues } from '#bundle-scan'
import { DEFAULT_ENV_PREFIXES } from '#env-classification'
import { collectClientReachableModuleIds, buildImportChainToModule, buildImportChainViaImporters } from '#graph'
import type { GetImportedModuleIds, GetImporterModuleIds } from '#graph'
import {
  registerTaintedModule,
  clearTaintedModule,
  clearAllTaintedModules,
  getAllTaintedModules,
  hasTaintedModules,
} from '#registry'
import {
  buildSuggestedFix,
  formatViolationForTerminal,
  formatBundleLeakForTerminal,
  formatViolationForOverlay,
} from '#reporter'
import { scanModuleSource } from '#scanner'
import type { SafeEnvOptions, ResolvedSafeEnvOptions, BlockOnMode, TaintedModule, Violation } from '#types'
import { createDebouncedAnalysisScheduler } from '#worker'
import type { DebouncedAnalysisScheduler } from '#worker'

export type { SafeEnvOptions, BlockOnMode } from '#types'

const DEFAULT_INCLUDE = ['**/*.{ts,tsx,js,jsx,vue,svelte}']
const DEFAULT_EXCLUDE = ['node_modules/**', 'dist/**']
const DEV_ANALYSIS_QUIET_PERIOD_MS = 150

/**
 * Merges user-supplied options with plugin defaults.
 *
 * @param userOptions - The optional user-supplied configuration.
 * @returns A complete options object with all defaults applied.
 */
function resolvePluginOptions(userOptions: SafeEnvOptions | undefined): ResolvedSafeEnvOptions {
  return {
    allowClientAccess: userOptions?.allowClientAccess ?? [],
    blockOn: userOptions?.blockOn ?? 'production',
    overlay: userOptions?.overlay ?? true,
  }
}

/**
 * Returns `true` if the plugin should abort the build based on the configured
 * `blockOn` mode and the current `NODE_ENV`.
 *
 * @param blockOnMode - The configured blocking behaviour.
 * @returns `true` if the plugin should treat violations as fatal errors.
 */
function shouldBlockBuild(blockOnMode: BlockOnMode): boolean {
  if (blockOnMode === 'never') {
    return false
  }
  if (blockOnMode === 'always') {
    return true
  }
  return process.env['NODE_ENV'] === 'production'
}

/**
 * Resolves the client entry point module IDs from the Vite resolved config.
 * Falls back to `<root>/index.html` when no explicit rollup input is configured.
 *
 * @param resolvedViteConfig - The fully resolved Vite configuration object.
 * @returns An array of absolute module IDs representing client entry points.
 */
function resolveClientEntryModuleIds(resolvedViteConfig: ResolvedConfig): string[] {
  const rollupInput = resolvedViteConfig.build.rollupOptions?.input

  if (!rollupInput) {
    return [`${resolvedViteConfig.root}/index.html`]
  }
  if (typeof rollupInput === 'string') {
    return [rollupInput]
  }
  if (Array.isArray(rollupInput)) {
    return rollupInput
  }

  return Object.values(rollupInput)
}

/**
 * Constructs a `Violation` for every env-var access inside the given tainted
 * module and forwards each one to `onViolation`. Shared by the dev-mode and
 * build-mode paths so that the `Violation` shape is defined in exactly one place.
 *
 * @param taintedModule - The module whose accesses will be emitted as violations.
 * @param importChain - The pre-computed client entry to module import chain.
 * @param onViolation - Called once for each constructed `Violation`.
 */
function emitViolationsForTaintedModule(
  taintedModule: TaintedModule,
  importChain: string[],
  onViolation: (violation: Violation) => void
): void {
  for (const envAccess of taintedModule.accesses) {
    onViolation({
      moduleId: taintedModule.moduleId,
      envVarName: envAccess.envVarName,
      line: envAccess.line,
      column: envAccess.column,
      importChain,
      suggestedFix: buildSuggestedFix(envAccess.envVarName, importChain),
    })
  }
}

/**
 * Walks every tainted module reachable from the client entry points and emits
 * a `Violation` for each env-var access via `onViolation`. The import chain is
 * computed once per tainted module, not once per access.
 *
 * @param clientEntryModuleIds - Entry points used as BFS roots.
 * @param graphAdapter - Returns the direct imported module IDs for a given module.
 * @param onViolation - Called once for each constructed `Violation`.
 */
function reportClientReachableViolations(
  clientEntryModuleIds: string[],
  graphAdapter: GetImportedModuleIds,
  onViolation: (violation: Violation) => void
): void {
  const reachableModuleIds = collectClientReachableModuleIds(clientEntryModuleIds, graphAdapter)

  for (const taintedModule of getAllTaintedModules()) {
    if (!reachableModuleIds.has(taintedModule.moduleId)) {
      continue
    }

    const importChain = buildImportChainToModule(taintedModule.moduleId, clientEntryModuleIds, graphAdapter)
    emitViolationsForTaintedModule(taintedModule, importChain, onViolation)
  }
}

/**
 * A Vite plugin that prevents server-only environment variables from leaking
 * into client-side bundles through two coordinated detection phases.
 *
 * Phase 1 uses the `transform` hook to detect env var accesses in source modules,
 * then walks the module graph in `buildEnd` to identify client-reachable leaks.
 *
 * Phase 2 uses `generateBundle` to scan compiled output chunks for literal env var
 * values, with sourcemap resolution for precise attribution.
 *
 * @param userOptions - Optional {@link SafeEnvOptions}. All fields default to safe, non-intrusive values.
 * @returns A Vite plugin object ready to be added to the `plugins` array.
 *
 * @example
 * ```ts
 * import safeEnv from 'vite-plugin-safe-env'
 *
 * export default defineConfig({
 *   plugins: [safeEnv()],
 * })
 * ```
 */
export default function safeEnv(userOptions?: SafeEnvOptions): Plugin {
  const resolvedOptions = resolvePluginOptions(userOptions)
  const moduleFilter = createFilter(userOptions?.include ?? DEFAULT_INCLUDE, userOptions?.exclude ?? DEFAULT_EXCLUDE)
  const allowClientAccessSet = new Set(resolvedOptions.allowClientAccess)
  let resolvedViteConfig: ResolvedConfig
  let envPrefixes = DEFAULT_ENV_PREFIXES
  let devAnalysisScheduler: DebouncedAnalysisScheduler | null = null

  return {
    name: 'vite-plugin-safe-env',
    // Must run before Vite's built-in define plugin, which replaces process.env.X
    // member expressions with inlined literals before a 'post' transform hook would run.
    enforce: 'pre',

    configResolved(config: ResolvedConfig): void {
      resolvedViteConfig = config
      // Mirror the prefixes Vite itself exposes through `import.meta.env`, so a
      // custom `envPrefix` is respected instead of assuming the `VITE_` default.
      envPrefixes = resolveEnvPrefix({ envPrefix: config.envPrefix })
      clearAllTaintedModules()
    },

    transform(sourceCode: string, moduleId: string): null {
      if (!moduleFilter(moduleId)) {
        return null
      }

      const envAccesses = scanModuleSource(sourceCode, allowClientAccessSet, envPrefixes)

      if (envAccesses.length > 0) {
        registerTaintedModule({ moduleId, accesses: envAccesses })
        devAnalysisScheduler?.schedule()
      }

      return null
    },

    configureServer(server) {
      // The dev-mode analysis traverses `importers` upward from each tainted module
      // rather than `importedModules` downward from the HTML entry, because Vite's
      // dev `moduleGraph` does not populate imports on the HTML node. Any module
      // present in the dev graph is client-reachable by construction: the browser
      // requested it.
      const devImporterAdapter: GetImporterModuleIds = (moduleId) => {
        const moduleNode = server.moduleGraph.getModuleById(moduleId)
        return [...(moduleNode?.importers ?? [])].flatMap((importerNode) => (importerNode.id ? [importerNode.id] : []))
      }

      devAnalysisScheduler = createDebouncedAnalysisScheduler(async () => {
        if (!hasTaintedModules()) {
          return
        }

        for (const taintedModule of getAllTaintedModules()) {
          if (!server.moduleGraph.getModuleById(taintedModule.moduleId)) {
            continue
          }

          const importChain = buildImportChainViaImporters(taintedModule.moduleId, devImporterAdapter)

          emitViolationsForTaintedModule(taintedModule, importChain, (violation) => {
            if (resolvedOptions.overlay) {
              server.ws.send(formatViolationForOverlay(violation))
            }
          })
        }
      }, DEV_ANALYSIS_QUIET_PERIOD_MS)
    },

    handleHotUpdate({ file }) {
      clearTaintedModule(file)
      devAnalysisScheduler?.schedule()
    },

    closeWatcher(): void {
      devAnalysisScheduler?.cancel()
      devAnalysisScheduler = null
    },

    buildEnd(): void {
      if (!hasTaintedModules()) {
        return
      }

      const clientEntryModuleIds = resolveClientEntryModuleIds(resolvedViteConfig)

      const buildGraphAdapter: GetImportedModuleIds = (moduleId) => {
        const moduleInfo = this.getModuleInfo(moduleId)
        return moduleInfo ? [...moduleInfo.importedIds, ...moduleInfo.dynamicallyImportedIds] : []
      }

      const shouldBlock = shouldBlockBuild(resolvedOptions.blockOn)

      reportClientReachableViolations(clientEntryModuleIds, buildGraphAdapter, (violation) => {
        const message = formatViolationForTerminal(violation)
        if (shouldBlock) {
          this.error(message)
        } else {
          this.warn(message)
        }
      })
    },

    generateBundle(_outputOptions, outputBundle): void {
      const serverEnvVarValues = collectServerEnvVarValues(resolvedOptions.allowClientAccess, envPrefixes)
      if (serverEnvVarValues.size === 0) {
        return
      }

      const shouldBlock = shouldBlockBuild(resolvedOptions.blockOn)

      for (const [chunkFileName, outputChunk] of Object.entries(outputBundle)) {
        if (outputChunk.type !== 'chunk') {
          continue
        }

        const bundleLeaks = scanOutputChunk({
          chunkCode: outputChunk.code,
          chunkFileName,
          knownSecrets: serverEnvVarValues,
          // Rollup's SourceMap satisfies TraceMap's constructor; cast resolves optional-field structural mismatch.
          sourceMap: (outputChunk.map ?? null) as SourceMapInput | null,
        })

        for (const bundleLeak of bundleLeaks) {
          const message = formatBundleLeakForTerminal(bundleLeak)
          if (shouldBlock) {
            this.error(message)
          } else {
            this.warn(message)
          }
        }
      }
    },
  }
}
