import { useCallback, useState } from 'react';
import type { OAuthClient, OAuthConfig, TokenSet } from '@mere/fhir-oauth';
import { useOAuthSession, type OAuthVendor } from './useOAuthSession';

interface UseOAuthFlowOptions {
  client: OAuthClient;
  vendor: OAuthVendor;
}

export const useOAuthFlow = ({ client, vendor }: UseOAuthFlowOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { saveSession, loadSession, clearSession } = useOAuthSession(vendor);

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
