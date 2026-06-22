/**
 * Vite's default `envPrefix`. Used when a project does not configure its own
 * `envPrefix`; mirrors Vite's own default so classification stays in sync.
 */
export const DEFAULT_ENV_PREFIXES: readonly string[] = ['VITE_']

/**
 * Returns `true` if the given environment variable is permitted on the client side.
 * A variable is client-permitted when it carries one of the configured env
 * prefixes (`VITE_` by default, which Vite exposes through `import.meta.env`) or
 * when it appears in the explicit allowlist provided by the user.
 *
 * @param envVarName - The name of the environment variable to classify.
 * @param allowClientAccess - The set of variable names explicitly allowed on the client.
 * @param envPrefixes - Prefixes Vite exposes to the client (resolved `envPrefix`).
 *   Defaults to {@link DEFAULT_ENV_PREFIXES} (`VITE_`).
 * @returns `true` if the variable may be accessed from client-side code.
 */
export function isClientPermittedEnvVar(
  envVarName: string,
  allowClientAccess: Set<string>,
  envPrefixes: readonly string[] = DEFAULT_ENV_PREFIXES
): boolean {
  return envPrefixes.some((prefix) => envVarName.startsWith(prefix)) || allowClientAccess.has(envVarName)
}
