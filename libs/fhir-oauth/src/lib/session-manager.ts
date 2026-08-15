import type { AuthorizationRequestState, StorageAdapter } from './types.js';

export interface SessionManager {
  save(session: AuthorizationRequestState): Promise<void>;
  load(): Promise<AuthorizationRequestState | null>;
  clear(): Promise<void>;
}

/**
 * Creates a session manager for persisting OAuth state across browser redirects.
 * Use this in non-React code paths. For React components, prefer useOAuthorizationRequestState.
 *
 * @param vendor - Unique key to namespace the session (e.g., 'epic', 'cerner')
 * @param storage - Storage adapter (defaults to sessionStorage in browser)
 */
export function createSessionManager(
  vendor: string,
  storage?: StorageAdapter,
): SessionManager {
  const resolvedStorage =
    storage ?? (typeof window !== 'undefined' ? sessionStorage : undefined);

  if (!resolvedStorage) {
    throw new Error(
      'No storage adapter available. Pass a storage option or run in a browser environment.',
    );
  }

  const verifierKey = `${vendor}_code_verifier`;
  const stateKey = `${vendor}_oauth_state`;
  const nonceKey = `${vendor}_oauth_nonce`;

  return {
    async save(session: AuthorizationRequestState): Promise<void> {
      if (session.codeVerifier) {
        await resolvedStorage.setItem(verifierKey, session.codeVerifier);
      }
      if (session.state) {
        await resolvedStorage.setItem(stateKey, session.state);
      }
      if (session.nonce) {
        await resolvedStorage.setItem(nonceKey, session.nonce);
      }
    },

    async load(): Promise<AuthorizationRequestState | null> {
      const verifier = await resolvedStorage.getItem(verifierKey);
      const state = await resolvedStorage.getItem(stateKey);
      const nonce = await resolvedStorage.getItem(nonceKey);
      if (!verifier && !state && !nonce) return null;
      return {
        codeVerifier: verifier ?? undefined,
        state: state ?? undefined,
        nonce: nonce ?? undefined,
        startedAt: 0,
      };
    },

    async clear(): Promise<void> {
      await resolvedStorage.removeItem(verifierKey);
      await resolvedStorage.removeItem(stateKey);
      await resolvedStorage.removeItem(nonceKey);
    },
  };
}
