/**
 * A single occurrence of a server-only environment variable access
 * found within a source module.
 */
export type EnvAccess = {
  /** The name of the environment variable, e.g. `DATABASE_URL`. */
  envVarName: string
  /** The one-based line number of the access in the source file. */
  line: number
  /** The one-based column number of the access in the source file. */
  column: number
}

/**
 * A source module that contains one or more server-only environment
 * variable accesses.
 */
export type TaintedModule = {
  /** The absolute file path of the module. */
  moduleId: string
  /** All environment variable accesses found within this module. */
  accesses: EnvAccess[]
}

/**
 * A confirmed or potential leak of a server-only environment variable
 * that is reachable from a client entry point.
 */
export type Violation = {
  /** The absolute file path of the module where the access occurs. */
  moduleId: string
  /** The name of the environment variable that may leak to the client. */
  envVarName: string
  /** The one-based line number of the access. */
  line: number
  /** The one-based column number of the access. */
  column: number
  /**
   * The ordered chain of module IDs from the client entry point down
   * to the module containing the access.
   *
   * @example ['src/main.tsx', 'src/components/UserCard.tsx', 'src/utils/db.ts']
   */
  importChain: string[]
  /** A human-readable recommendation for resolving this violation. */
  suggestedFix: string
}

/**
 * A confirmed environment variable leak found by scanning a compiled
 * output chunk, with the origin resolved via sourcemap.
 */
export type BundleLeak = {
  /** The file name of the output chunk that contains the leaked value. */
  chunkFileName: string
  /** The name of the environment variable whose value was found in the chunk. */
  envVarName: string
  /** The original source file path, resolved from the sourcemap. */
  originalFile: string
  /** The original one-based line number resolved from the sourcemap, or 0 if unavailable. */
  originalLine: number
  /** The original one-based column number resolved from the sourcemap, or 0 if unavailable. */
  originalColumn: number
}

/**
 * Controls when the plugin will abort the build upon detecting a leak.
 *
 * `'production'` aborts only when `NODE_ENV` is `production`.
 * `'always'` aborts on every build regardless of environment.
 * `'never'` reports violations but never aborts.
 */
export type BlockOnMode = 'production' | 'always' | 'never'

/**
 * User-facing configuration options for vite-plugin-safe-env.
 *
 * @example
 * ```ts
 * safeEnv({
 *   allowClientAccess: ['NODE_ENV', 'BUILD_TIMESTAMP'],
 *   blockOn: 'always',
 * })
 * ```
 */
export type SafeEnvOptions = {
  /**
   * Environment variable names explicitly permitted for client-side access,
   * even without the `VITE_` prefix.
   *
   * @default []
   */
  allowClientAccess?: string[]

  /**
   * When to abort the build with a non-zero exit code.
   *
   * @default 'production'
   */
  blockOn?: BlockOnMode

  /**
   * Glob patterns for source files the scanner will analyse.
   *
   * @default ['**\/*.{ts,tsx,js,jsx,vue,svelte}']
   */
  include?: string | string[]

  /**
   * Glob patterns for source files the scanner will skip.
   * Takes precedence over `include`.
   *
   * @default ['node_modules/**', 'dist/**']
   */
  exclude?: string | string[]

  /**
   * Whether to show the browser overlay in development mode.
   *
   * @default true
   */
  overlay?: boolean
}

/**
 * Resolved plugin options with all defaults applied.
 * Used internally after merging user options with defaults.
 * The `include` and `exclude` patterns are passed directly to Vite's
 * `createFilter` and are not stored here.
 */
export type ResolvedSafeEnvOptions = {
  allowClientAccess: string[]
  blockOn: BlockOnMode
  overlay: boolean
}
