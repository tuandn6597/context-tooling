/**
 * Secrets are read from the environment only (GitHub Actions injects them via
 * `secrets:` / Environments). Nothing is hardcoded. If a required secret is
 * missing we throw loudly so the run fails with a useful message instead of
 * silently committing an empty file.
 */

export function requireSecret(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `Missing required secret/environment variable "${name}". ` +
        `Add it to GitHub Environments -> Secrets and re-run. Refusing to write a partial or empty file.`,
    );
  }
  return value;
}

/** Look up a secret with a per-brand naming convention: `BASE_BRAND`, then fall back to `BASE`. */
export function brandSecret(env: NodeJS.ProcessEnv, base: string, brand: string): string {
  const key = `${base}_${brand.toUpperCase().replace(/-/g, '_')}`;
  return env[key] ?? env[base] ?? '';
}
