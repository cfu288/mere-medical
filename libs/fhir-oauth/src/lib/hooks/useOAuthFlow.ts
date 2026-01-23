import { useCallback, useReducer } from 'react';
import type { OAuthClient, OAuthConfig, StorageAdapter, CoreTokenSet } from '../types.js';
import { useOAuthorizationRequestState } from './useOAuthorizationRequestState.js';

export interface UseOAuthFlowOptions<K extends string, T extends CoreTokenSet = CoreTokenSet> {
  client: OAuthClient<T>;
  vendor: K;
  storage?: StorageAdapter;
}

type State =
  | { status: 'idle'; isLoading: false; error: null }
  | { status: 'loading'; isLoading: true; error: null }
  | { status: 'error'; isLoading: false; error: Error };

type Action =
  | { type: 'START' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: Error };

const initialState: State = { status: 'idle', isLoading: false, error: null };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      return { status: 'loading', isLoading: true, error: null };
    case 'SUCCESS':
      return { status: 'idle', isLoading: false, error: null };
    case 'ERROR':
      return { status: 'error', isLoading: false, error: action.error };
  }
}

/**
 * React hook that manages OAuth authorization flows across browser redirects.
 *
 * OAuth requires redirecting the user away to an authorization server and back,
 * which means the app loses all in-memory state. This hook solves that by:
 * - Persisting PKCE code verifier and state parameter in storage before redirect
 * - Restoring session state after redirect to complete the token exchange
 * - Providing React-friendly loading/error states
 *
 * @typeParam K - String literal type for the storage key (e.g., 'epic' | 'cerner')
 * @param client - The vendor-specific OAuth client (e.g., from createEpicClient)
 * @param vendor - Unique key to namespace the session in storage
 * @param storage - Storage adapter (defaults to sessionStorage in browser)
 */
export function useOAuthFlow<K extends string, T extends CoreTokenSet = CoreTokenSet>({
  client,
  vendor,
  storage,
}: UseOAuthFlowOptions<K, T>) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { saveSession, loadSession, clearSession } = useOAuthorizationRequestState(vendor, { storage });

  const initiateAuth = useCallback(
    async (config: OAuthConfig): Promise<{ url: string }> => {
      dispatch({ type: 'START' });

      try {
        const { url, session } = await client.initiateAuth(config);
        await saveSession(session);
        dispatch({ type: 'SUCCESS' });
        return { url };
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to initiate auth');
        dispatch({ type: 'ERROR', error });
        throw error;
      }
    },
    [client, saveSession],
  );

  const handleCallback = useCallback(
    async (
      searchParams: URLSearchParams,
      config: OAuthConfig,
    ): Promise<T> => {
      dispatch({ type: 'START' });

      try {
        const session = await loadSession();
        if (!session) {
          throw new Error('No OAuth session found - was initiateAuth called?');
        }

        const tokens = await client.handleCallback(
          searchParams,
          config,
          session,
        );
        await clearSession();
        dispatch({ type: 'SUCCESS' });
        return tokens;
      } catch (err) {
        await clearSession();
        const error =
          err instanceof Error ? err : new Error('OAuth callback failed');
        dispatch({ type: 'ERROR', error });
        throw error;
      }
    },
    [client, loadSession, clearSession],
  );

  return { initiateAuth, handleCallback, isLoading: state.isLoading, error: state.error, clearSession };
}
