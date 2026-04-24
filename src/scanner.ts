import { isClientPermittedEnvVar } from '#env-classification'
import type { EnvAccess } from '#types'

/**
 * Matches `process.env.VAR_NAME` or `import.meta.env.VAR_NAME` in source code
 * and captures the variable name after the dot.
 */
const ENV_PROPERTY_ACCESS_PATTERN = /(?:process\.env|import\.meta\.env)\.([A-Za-z_][A-Za-z0-9_]*)/g

/**
 * Scans a module's source code for accesses to server-only environment variables.
 * Applies a targeted regex pattern to find all `process.env` and
 * `import.meta.env` accesses that are not covered by the `VITE_` prefix or
 * the explicit allowlist.
 *
 * Position resolution uses an incremental character walk so the source string
 * is scanned exactly once regardless of the number of matches.
 *
 * @param sourceCode - The raw source text of the module to analyse.
 * @param allowClientAccess - The set of variable names explicitly allowed on the client.
 * @returns All environment variable accesses that are not permitted on the client side.
 */
export function scanModuleSource(sourceCode: string, allowClientAccess: Set<string>): EnvAccess[] {
  const foundAccesses: EnvAccess[] = []

  let trackerOffset = 0
  let trackerLine = 1
  let trackerColumn = 1

  for (const regexMatch of sourceCode.matchAll(ENV_PROPERTY_ACCESS_PATTERN)) {
    const envVarName = regexMatch[1]

    if (isClientPermittedEnvVar(envVarName, allowClientAccess)) {
      continue
    }

    const envVarNameOffset = regexMatch.index + regexMatch[0].length - envVarName.length

    while (trackerOffset < envVarNameOffset) {
      if (sourceCode[trackerOffset] === '\n') {
        trackerLine++
        trackerColumn = 1
      } else {
        trackerColumn++
      }
      trackerOffset++
    }

    foundAccesses.push({ envVarName, line: trackerLine, column: trackerColumn })
  }

  return foundAccesses
}
