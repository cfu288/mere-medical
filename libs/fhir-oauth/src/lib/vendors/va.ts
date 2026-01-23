import type {
  OAuthConfig,
  AuthorizationRequestState,
  TokenSet,
} from '../types.js';
import { OAuthErrors } from '../types.js';
import {
  generateAuthorizationRequestState,
  generateCodeChallenge,
} from '../session.js';
import {
  exchangeWithPkce,
  parseTokenResponse,
  validateCallback,
  isTokenExpired,
} from '../token-exchange.js';

export interface VAClient {
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

export function createVAClient(): VAClient {
  return {
    async initiateAuth(config) {
      const session = await generateAuthorizationRequestState({
        usePkce: true,
        useState: true,
        tenant: config.tenant,
      });

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
      });

      if (session.state) {
        params.set('state', session.state);
      }

      if (session.codeVerifier) {
        const challenge = await generateCodeChallenge(session.codeVerifier);
        params.set('code_challenge', challenge);
        params.set('code_challenge_method', 'S256');
      }

      const authUrl = config.tenant?.authUrl ?? '';
      const url = `${authUrl}?${params}`;

      return { url, session };
    },

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);
      const tokens = await exchangeWithPkce(code, config, session);
      const patientId = tokens.raw['patient'] as string | undefined;

      return { ...tokens, patientId };
    },

    async refresh(tokens, config) {
      if (!tokens.refreshToken) {
        throw new Error('No refresh token available');
      }

      if (!config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: config.clientId,
      });

      if (tokens.scope) {
        body.set('scope', tokens.scope);
      } else if (config.scopes?.length) {
        body.set('scope', config.scopes.join(' '));
      }

      const res = await fetch(config.tenant.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
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
