import type { OAuthConfig, AuthorizationRequestState, CoreTokenSet } from '../types.js';
import { createOAuthError, OAuthErrors } from '../types.js';
import { initiateStandardAuth } from '../auth-url.js';
import { exchangeWithPkce, parseTokenResponse, validateCallback, isTokenExpired } from '../token-exchange.js';

/**
 * Cerner standalone token responses do not include a patient field. Per Oracle docs:
 * "Upon retrieving an access token, an identity token is presented in the access
 * token response" - patient identity is extracted from fhirUser claim in id_token.
 * @see https://docs.oracle.com/en/industries/health/millennium-platform-apis/millennium-authorization-framework/#smart-application-launch-flow
 */
export type CernerTokenSet = CoreTokenSet & {
  refreshToken?: string;
  idToken?: string;
  scope?: string;
};

export interface CernerClient {
  initiateAuth: (
    config: OAuthConfig,
  ) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<CernerTokenSet>;
  refresh: (tokens: CernerTokenSet, config: OAuthConfig) => Promise<CernerTokenSet>;
  isExpired: (tokens: CernerTokenSet, bufferSeconds?: number) => boolean;
}

/**
 * Creates an OAuth client for Cerner/Oracle Health FHIR servers. Handles the
 * SMART on FHIR flow including PKCE and standard refresh_token grant for
 * token refresh. Unlike Epic, Cerner does not require JWT signing or dynamic
 * client registration.
 * @see https://docs.oracle.com/en/industries/health/millennium-platform-apis/millennium-authorization-framework/#smart-application-launch-flow
 */
export function createCernerClient(): CernerClient {
  return {
    initiateAuth: initiateStandardAuth,

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);
      return exchangeWithPkce(code, config, session);
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
      };
    },

    isExpired: isTokenExpired,
  };
}
