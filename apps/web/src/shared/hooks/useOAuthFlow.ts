import { useCallback, useState } from 'react';
import type { OAuthClient, OAuthConfig, TokenSet } from '@mere/fhir-oauth';
import {
  useOAuthorizationRequestState,
  type OAuthVendor,
} from './useOAuthSession';

interface UseOAuthFlowOptions {
  client: OAuthClient;
  vendor: OAuthVendor;
}

/**
 * React hook that manages OAuth authorization flows across browser redirects.
 *
 * OAuth requires redirecting the user away to an authorization server and back,
 * which means the app loses all in-memory state. This hook solves that by:
 * - Persisting PKCE code verifier and state parameter in sessionStorage before redirect
 * - Restoring session state after redirect to complete the token exchange
 * - Providing React-friendly loading/error states
 *
 * @param client - The vendor-specific OAuth client (e.g., from createEpicClient)
 * @param vendor - Vendor identifier used to namespace sessionStorage keys
 *
 * @returns
 * - `initiateAuth(config)` - Call on login page. Saves session, redirects to auth server.
 * - `handleCallback(searchParams, config)` - Call on callback page. Restores session,
 *    exchanges code for tokens, returns TokenSet.
 * - `isLoading` - True while auth operations are in progress
 * - `error` - Error object if auth failed, null otherwise
 *
 * @example
 * // Login page - user clicks "Connect to Epic"
 * const { initiateAuth } = useOAuthFlow({ client: epicClient, vendor: 'epic' });
 * await initiateAuth(oauthConfig); // Redirects away to Epic
 *
 * // Callback page - user returns from Epic
 * const { handleCallback } = useOAuthFlow({ client: epicClient, vendor: 'epic' });
 * const tokens = await handleCallback(new URLSearchParams(location.search), oauthConfig);
 */
export const useOAuthFlow = ({ client, vendor }: UseOAuthFlowOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { saveSession, loadSession, clearSession } =
    useOAuthorizationRequestState(vendor);

  const initiateAuth = useCallback(
    async (config: OAuthConfig) => {
      setIsLoading(true);
      setError(null);

      try {
        const { url, session } = await client.initiateAuth(config);
        saveSession(session);
        window.location.href = url;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to initiate auth');
        setError(error);
        setIsLoading(false);
        throw error;
      }
    },
    [client, saveSession],
  );

  const handleCallback = useCallback(
    async (
      searchParams: URLSearchParams,
      config: OAuthConfig,
    ): Promise<TokenSet> => {
      setIsLoading(true);
      setError(null);

      try {
        const session = loadSession();
        if (!session) {
          throw new Error('No OAuth session found - was initiateAuth called?');
        }

        const tokens = await client.handleCallback(
          searchParams,
          config,
          session,
        );
        clearSession();
        return tokens;
      } catch (err) {
        clearSession();
        const error =
          err instanceof Error ? err : new Error('OAuth callback failed');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, loadSession, clearSession],
  );

  return { initiateAuth, handleCallback, isLoading, error };
};
