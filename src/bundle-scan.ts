import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import type { SourceMapInput } from '@jridgewell/trace-mapping'

import { isClientPermittedEnvVar, DEFAULT_ENV_PREFIXES } from '#env-classification'
import type { BundleLeak } from '#types'

const MINIMUM_SECRET_LENGTH = 4

const UNRESOLVED_LEAK_ORIGIN = { originalFile: 'unknown', originalLine: 0, originalColumn: 0 } as const

/**
 * Options accepted by {@link scanOutputChunk} for scanning a single compiled
 * output chunk for leaked server-only environment variable values.
 */
export type ScanOutputChunkOptions = {
  /** The compiled source code of the output chunk to scan. */
  chunkCode: string
  /** The file name of the output chunk, used for reporting. */
  chunkFileName: string
  /** A map of environment variable name to its current string value. */
  knownSecrets: Map<string, string>
  /** The source map for the chunk, used to resolve original file and line. */
  sourceMap: SourceMapInput | null
}

/**
 * Scans a compiled output chunk for the literal string values of known
 * server-only environment variables. For each match, attempts to resolve
 * the original source file and line number using the chunk's source map.
 *
 * The source map is parsed once per chunk, not once per matched secret.
 * Secrets shorter than {@link MINIMUM_SECRET_LENGTH} characters are skipped
 * to avoid false positives on common short strings.
 *
 * @param options - The chunk code, file name, known secret values, and optional source map.
 * @returns An array of confirmed bundle leaks found within the chunk.
 */
export function scanOutputChunk(options: ScanOutputChunkOptions): BundleLeak[] {
  const { chunkCode, chunkFileName, knownSecrets, sourceMap } = options
  const confirmedLeaks: BundleLeak[] = []

  const traceMap = sourceMap ? tryBuildTraceMap(sourceMap) : null

  for (const [envVarName, secretValue] of knownSecrets) {
    if (!secretValue || secretValue.length < MINIMUM_SECRET_LENGTH) {
      continue
    }

    const secretValueIndex = chunkCode.indexOf(secretValue)
    if (secretValueIndex === -1) {
      continue
    }

    confirmedLeaks.push({
      chunkFileName,
      envVarName,
      ...resolveLeakOrigin(chunkCode, secretValueIndex, traceMap),
    })
  }

  return confirmedLeaks
}

/**
 * Collects the current string values of all environment variables that are
 * considered server-only: those without a configured env prefix (`VITE_` by
 * default) and not listed in the explicit allowlist.
 *
 * @param allowClientAccess - Variable names explicitly permitted for client use.
 * @param envPrefixes - Prefixes Vite exposes to the client (resolved `envPrefix`).
 *   Defaults to {@link DEFAULT_ENV_PREFIXES} (`VITE_`).
 * @returns A Map of environment variable name to its current process value.
 */
export function collectServerEnvVarValues(
  allowClientAccess: string[],
  envPrefixes: readonly string[] = DEFAULT_ENV_PREFIXES
): Map<string, string> {
  const serverEnvVarValues = new Map<string, string>()
  const allowSet = new Set(allowClientAccess)

  for (const [envVarName, envVarValue] of Object.entries(process.env)) {
    if (envVarValue === undefined || isClientPermittedEnvVar(envVarName, allowSet, envPrefixes)) {
      continue
    }

    serverEnvVarValues.set(envVarName, envVarValue)
  }

  return serverEnvVarValues
}

/**
 * Attempts to construct a `TraceMap` from the given source map input.
 * Returns `null` if the source map is malformed or cannot be parsed.
 *
 * @param sourceMap - The source map to parse.
 * @returns A parsed `TraceMap`, or `null` on failure.
 */
function tryBuildTraceMap(sourceMap: SourceMapInput): TraceMap | null {
  try {
    return new TraceMap(sourceMap)
  } catch {
    return null
  }
}

/**
 * Resolves the character offset of a match in a compiled chunk to the
 * original source file, line, and column using a pre-parsed `TraceMap`.
 * Returns fallback values when the trace map is absent or resolution fails.
 *
 * @param chunkCode - The full compiled chunk source code.
 * @param matchCharacterOffset - The zero-based character index of the match.
 * @param traceMap - A pre-parsed `TraceMap` for the chunk, or `null`.
 * @returns The resolved original file path, one-based line number, and one-based column number.
 */
function resolveLeakOrigin(
  chunkCode: string,
  matchCharacterOffset: number,
  traceMap: TraceMap | null
): { originalFile: string; originalLine: number; originalColumn: number } {
  if (!traceMap) {
    return UNRESOLVED_LEAK_ORIGIN
  }

  const precedingText = chunkCode.slice(0, matchCharacterOffset)
  const precedingLines = precedingText.split('\n')

  try {
    const resolvedPosition = originalPositionFor(traceMap, {
      line: precedingLines.length,
      column: precedingLines[precedingLines.length - 1].length,
    })

    return {
      originalFile: resolvedPosition.source ?? 'unknown',
      originalLine: resolvedPosition.line ?? 0,
      originalColumn: resolvedPosition.column ?? 0,
    }
  } catch {
    return UNRESOLVED_LEAK_ORIGIN
  }
}
