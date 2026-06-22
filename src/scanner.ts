import { isClientPermittedEnvVar, DEFAULT_ENV_PREFIXES } from '#env-classification'
import type { EnvAccess } from '#types'

/**
 * Matches `process.env.VAR_NAME` or `import.meta.env.VAR_NAME` in source code
 * and captures the variable name after the dot.
 */
const ENV_PROPERTY_ACCESS_PATTERN = /(?:process\.env|import\.meta\.env)\.([A-Za-z_][A-Za-z0-9_]*)/g

/**
 * Scans a module's source code for accesses to server-only environment variables.
 * Applies a targeted regex pattern to find all `process.env` and
 * `import.meta.env` accesses that are not covered by a configured env prefix
 * (`VITE_` by default) or the explicit allowlist.
 *
 * Each reported access carries the 1-based line and column of its variable name.
 *
 * @param sourceCode - The raw source text of the module to analyse.
 * @param allowClientAccess - The set of variable names explicitly allowed on the client.
 * @param envPrefixes - Prefixes Vite exposes to the client (resolved `envPrefix`).
 *   Defaults to {@link DEFAULT_ENV_PREFIXES} (`VITE_`).
 * @returns All environment variable accesses that are not permitted on the client side.
 */
export function scanModuleSource(
  sourceCode: string,
  allowClientAccess: Set<string>,
  envPrefixes: readonly string[] = DEFAULT_ENV_PREFIXES
): EnvAccess[] {
  const foundAccesses: EnvAccess[] = []

  for (const regexMatch of sourceCode.matchAll(ENV_PROPERTY_ACCESS_PATTERN)) {
    const envVarName = regexMatch[1]

    if (isClientPermittedEnvVar(envVarName, allowClientAccess, envPrefixes)) {
      continue
    }

    const envVarNameOffset = regexMatch.index + regexMatch[0].length - envVarName.length
    foundAccesses.push({ envVarName, ...resolveLineAndColumn(sourceCode, envVarNameOffset) })
  }

  return foundAccesses
}

/**
 * Resolves a zero-based character offset to its 1-based line and column from the
 * source text that precedes it.
 *
 * @param sourceCode - The source text the offset refers to.
 * @param offset - The zero-based character offset to resolve.
 * @returns The 1-based line and column at that offset.
 */
function resolveLineAndColumn(sourceCode: string, offset: number): { line: number; column: number } {
  const precedingText = sourceCode.slice(0, offset)

  return {
    line: precedingText.split('\n').length,
    column: offset - precedingText.lastIndexOf('\n'),
  }
}
