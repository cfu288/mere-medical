import type { OAuthConfig, AuthorizationRequestState, TokenSet } from '../types.js';
import { createOAuthError } from '../types.js';
import { buildStandardAuthUrl } from '../auth-url.js';
import { exchangeWithPkce, parseTokenResponse } from '../token-exchange.js';
import { generateAuthorizationRequestState } from '../session.js';

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
    async initiateAuth(config) {
      const session = await generateAuthorizationRequestState({
        usePkce: true,
        useState: true,
        tenant: config.tenant,
      });
      const url = await buildStandardAuthUrl(config, session);
      return { url, session };
    },

    async handleCallback(params, config, session) {
      const error = params.get('error');
      if (error) {
        throw createOAuthError(
          error,
          params.get('error_description') ?? 'OAuth error',
        );
      }

      const returnedState = params.get('state');
      if (returnedState !== session.state) {
        throw createOAuthError(
          'state_mismatch',
          'OAuth state validation failed',
        );
      }

      const code = params.get('code');
      if (!code) {
        throw createOAuthError(
          'missing_code',
          'No authorization code in callback',
        );
      }

      const tokens = await exchangeWithPkce(code, config, session);

      const patientId = tokens.raw['patient'] as string | undefined;
      if (!patientId) {
        throw createOAuthError(
          'missing_patient',
          'No patient field in token response',
        );
      }

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
        throw createOAuthError('no_token_url', 'No token URL provided');
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

    isExpired(tokens, bufferSeconds = 60) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      return tokens.expiresAt <= nowSeconds + bufferSeconds;
    },
  };
}
