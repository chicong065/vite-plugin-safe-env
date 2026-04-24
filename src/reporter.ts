import type { BundleLeak, Violation } from '#types'

const bold = (text: string): string => `\x1b[1m${text}\x1b[22m`
const cyan = (text: string): string => `\x1b[36m${text}\x1b[39m`
const yellow = (text: string): string => `\x1b[33m${text}\x1b[39m`
const red = (text: string): string => `\x1b[31m${text}\x1b[39m`
const underline = (text: string): string => `\x1b[4m${text}\x1b[24m`

const PLUGIN_LABEL = bold(cyan('[vite-plugin-safe-env]'))

const CREDENTIAL_KEYWORDS = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'PASS', 'CREDENTIAL']
const LOCATION_KEYWORDS = ['URL', 'HOST', 'ENDPOINT', 'URI', 'ADDR']

/**
 * Assembles the standard terminal output block used by all violation and leak
 * formatters. Accepts the headline, a list of field lines, and the body text
 * for the Risk and Fix sections.
 */
function formatMessageSections(headline: string, fieldLines: string[], riskBody: string, fixBody: string): string {
  return [
    '',
    `${PLUGIN_LABEL} ${headline}`,
    '',
    ...fieldLines,
    '',
    `  Risk`,
    `  ${riskBody}`,
    '',
    `  Fix`,
    `  ${fixBody}`,
    '',
  ].join('\n')
}

/**
 * Generates a context-aware fix suggestion based on the environment variable
 * name and the import chain that makes it reachable from the client.
 * Variables matching credential keywords receive a security-focused warning.
 * Variables whose import chain passes through a server-named file receive
 * advice about import structure. All others receive a general relocation suggestion.
 *
 * @param envVarName - The name of the leaked environment variable.
 * @param importChain - The ordered list of module IDs from the client entry to the leak.
 * @returns A human-readable recommendation for resolving the violation.
 */
export function buildSuggestedFix(envVarName: string, importChain: string[]): string {
  const nameSegments = envVarName.toUpperCase().split('_')

  const importChainPassesThroughServerFile = importChain.some((modulePath) => {
    const fileName = modulePath.split('/').pop() ?? ''
    return (
      modulePath.includes('/server/') ||
      modulePath.includes('/api/') ||
      modulePath.includes('/routes/') ||
      fileName.startsWith('+server.') ||
      /\.server\.(ts|tsx|js|jsx|mts|mjs)$/.test(modulePath)
    )
  })

  if (importChainPassesThroughServerFile) {
    return (
      `The module containing this access is named correctly but is imported from ` +
      `a client entry point. Remove the import from the client-side module, or extract ` +
      `the shared logic into a file that does not access server environment variables.`
    )
  }

  if (CREDENTIAL_KEYWORDS.some((keyword) => nameSegments.includes(keyword))) {
    return (
      `${envVarName} appears to be a credential. Exposing it in the client bundle ` +
      `is a security vulnerability. Move all access into a server-only module that ` +
      `is never imported from a client entry point.`
    )
  }

  if (LOCATION_KEYWORDS.some((keyword) => nameSegments.includes(keyword))) {
    return (
      `${envVarName} is a server-side connection value. Move all database or service ` +
      `connection logic into a server-only module. If this value is intentionally ` +
      `public, add it to the allowClientAccess option in your Vite config.`
    )
  }

  return (
    `Move all access to ${envVarName} into a server-only module that is never ` +
    `imported from a client entry point. If this variable is intentionally public, ` +
    `add it to the allowClientAccess option in your Vite config.`
  )
}

/**
 * Formats a potential violation as a human-readable multi-line terminal string.
 *
 * @param violation - The violation to format.
 * @returns A formatted string ready for terminal output.
 */
export function formatViolationForTerminal(violation: Violation): string {
  return formatMessageSections(
    'Server-only environment variable may leak to client bundle',
    [
      `  Variable    ${yellow(violation.envVarName)}`,
      `  File        ${underline(violation.moduleId)}:${violation.line}`,
      '',
      `  Reachable via`,
      ...violation.importChain.map((modulePath) => `              ${modulePath}`),
    ],
    `The value of ${violation.envVarName} will be visible in your production\n  JavaScript bundle to anyone who opens browser DevTools.`,
    violation.suggestedFix
  )
}

/**
 * Formats a confirmed bundle leak as a human-readable multi-line terminal string.
 * This is the Phase 2 ground-truth error with precise source attribution from
 * sourcemap resolution.
 *
 * @param bundleLeak - The confirmed bundle leak to format.
 * @returns A formatted string ready for terminal output.
 */
export function formatBundleLeakForTerminal(bundleLeak: BundleLeak): string {
  return formatMessageSections(
    'Server-only environment variable confirmed in client bundle',
    [
      `  Variable    ${red(bundleLeak.envVarName)}`,
      `  Chunk       ${bundleLeak.chunkFileName}`,
      `  Origin      ${underline(bundleLeak.originalFile)}:${bundleLeak.originalLine}`,
    ],
    `The actual value of ${bundleLeak.envVarName} is present in the output bundle\n  and is readable by anyone who downloads the file.`,
    `Remove all server-only environment variable access from modules that are\n  reachable from client entry points.`
  )
}

/**
 * Formats a violation as a browser overlay error payload compatible with
 * Vite's built-in error overlay WebSocket protocol.
 *
 * @param violation - The violation to format for the browser overlay.
 * @returns A payload object ready to send via `server.ws.send`.
 */
export function formatViolationForOverlay(violation: Violation): {
  type: 'error'
  err: { message: string; stack: string; plugin: string }
} {
  const message = [
    `Server-only environment variable may leak to client bundle`,
    ``,
    `Variable: ${violation.envVarName}`,
    `File: ${violation.moduleId}:${violation.line}`,
    ``,
    `Reachable via: ${violation.importChain.join(' > ')}`,
    ``,
    violation.suggestedFix,
  ].join('\n')

  return {
    type: 'error',
    err: {
      message,
      stack: `    at ${violation.moduleId}:${violation.line}:${violation.column}`,
      plugin: 'vite-plugin-safe-env',
    },
  }
}
