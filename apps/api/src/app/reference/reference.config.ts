import { isConfigured } from '@mere/shared';

/**
 * Whether the API serves the reference library. `REFERENCE_DB_PATH` names a
 * library file that `npx nx run reference-pipeline:build-library` built.
 */
export type ReferenceLibraryConfig =
  | { status: 'disabled' }
  | { status: 'enabled'; path: string };

/**
 * Reads `REFERENCE_DB_PATH` from the environment. `AppModule` calls it at
 * startup to choose whether to import `ReferenceModule`.
 *
 * @param env `Record<string, string | undefined>`. Usually `process.env`.
 * @returns `ReferenceLibraryConfig`.
 *
 * @example
 * parseReferenceLibraryConfig({ REFERENCE_DB_PATH: '/data/references.db' });
 */
export function parseReferenceLibraryConfig(
  env: Record<string, string | undefined>,
): ReferenceLibraryConfig {
  const path = env.REFERENCE_DB_PATH?.trim();
  return isConfigured(path)
    ? { status: 'enabled', path }
    : { status: 'disabled' };
}
