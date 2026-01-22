import { useCallback, useMemo } from 'react';
import type { AuthorizationRequestState, StorageAdapter } from '../types.js';
import { createSessionManager } from '../session-manager.js';

export interface UseOAuthorizationRequestStateOptions {
  storage?: StorageAdapter;
}

/**
 * React hook for persisting OAuth session state across browser redirects.
 *
 * OAuth flows require redirecting to an authorization server and back, which
 * loses all in-memory state. This hook persists the PKCE code verifier and
 * state parameter in storage so they can be restored on the callback page.
 *
 * @typeParam K - String literal type for the storage key (e.g., 'epic' | 'cerner')
 * @param vendor - Unique key to namespace the session in storage
 * @param options.storage - Storage adapter (defaults to sessionStorage in browser)
 */
export function useOAuthorizationRequestState<K extends string>(
  vendor: K,
  options?: UseOAuthorizationRequestStateOptions,
) {
  const manager = useMemo(
    () => createSessionManager(vendor, options?.storage),
    [vendor, options?.storage],
  );

  const saveSession = useCallback(
    (session: AuthorizationRequestState): Promise<void> => manager.save(session),
    [manager],
  );

  const loadSession = useCallback(
    (): Promise<AuthorizationRequestState | null> => manager.load(),
    [manager],
  );

  const clearSession = useCallback(
    (): Promise<void> => manager.clear(),
    [manager],
  );

  return { saveSession, loadSession, clearSession };
}
