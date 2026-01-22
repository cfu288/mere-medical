import type { OAuthConfig, AuthorizationRequestState, TokenSet } from '../types.js';
import { createOAuthError, OAuthErrors } from '../types.js';
import { initiateStandardAuth } from '../auth-url.js';
import { exchangeWithPkce, parseTokenResponse, validateCallback, isTokenExpired } from '../token-exchange.js';

export interface CernerClient {
  initiateAuth: (
    config: OAuthConfig,
  ) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<TokenSet>;
  refresh: (tokens: TokenSet, config: OAuthConfig) => Promise<TokenSet>;
  isExpired: (tokens: TokenSet, bufferSeconds?: number) => boolean;
}

/**
 * Creates an OAuth client for Cerner/Oracle Health FHIR servers. Handles the
 * SMART on FHIR flow including PKCE and standard refresh_token grant for
 * token refresh. Unlike Epic, Cerner does not require JWT signing or dynamic
 * client registration.
 */
export function createCernerClient(): CernerClient {
  return {
    initiateAuth: initiateStandardAuth,

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);
      const tokens = await exchangeWithPkce(code, config, session);
      const patientId = tokens.raw['patient'] as string | undefined;

      return { ...tokens, patientId };
    },

    async refresh(tokens, config) {
      if (!tokens.refreshToken) {
        throw createOAuthError(
          'refresh_not_supported',
          'No refresh token available',
        );
      }

      if (!config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      const res = await fetch(config.tenant.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
        }),
      });

      const newTokens = await parseTokenResponse(res);

      return {
        ...newTokens,
        idToken: newTokens.idToken ?? tokens.idToken,
        patientId: tokens.patientId,
      };
    },

    isExpired: isTokenExpired,
  };
}
