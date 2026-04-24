/**
 * Returns `true` if the given environment variable is permitted on the client side.
 * A variable is client-permitted when it carries Vite's `VITE_` prefix (which Vite
 * itself exposes to the client by convention) or when it appears in the explicit
 * allowlist provided by the user.
 *
 * @param envVarName - The name of the environment variable to classify.
 * @param allowClientAccess - The set of variable names explicitly allowed on the client.
 * @returns `true` if the variable may be accessed from client-side code.
 */
export function isClientPermittedEnvVar(envVarName: string, allowClientAccess: Set<string>): boolean {
  return envVarName.startsWith('VITE_') || allowClientAccess.has(envVarName)
}
