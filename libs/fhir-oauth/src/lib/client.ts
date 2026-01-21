import type { OAuthConfig, AuthSession, TokenSet } from './types.js';
import { createOAuthError } from './types.js';
import { createSession } from './session.js';
import type { AuthUrlBuilder } from './auth-url.js';
import type { TokenExchanger } from './token-exchange.js';
import type { TokenRefresher } from './token-refresh.js';
import type { PatientIdExtractor } from './patient-id.js';

export interface OAuthClientSpec {
  sessionOptions: { usePkce: boolean; useState: boolean };
  buildAuthUrl: AuthUrlBuilder;
  exchangeToken: TokenExchanger;
  extractPatientId: PatientIdExtractor;
  refreshToken: TokenRefresher;
}

export interface OAuthClient {
  initiateAuth: (
    config: OAuthConfig
  ) => Promise<{ url: string; session: AuthSession }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthSession
  ) => Promise<TokenSet>;
  refresh: (tokens: TokenSet, config: OAuthConfig) => Promise<TokenSet>;
  isExpired: (tokens: TokenSet, bufferSeconds?: number) => boolean;
  canRefresh: (tokens: TokenSet) => boolean;
}

export const createOAuthClient = (spec: OAuthClientSpec): OAuthClient => ({
  async initiateAuth(config) {
    const session = await createSession({
      ...spec.sessionOptions,
      tenant: config.tenant,
    });
    const url = await spec.buildAuthUrl(config, session);
    return { url, session };
  },

  async handleCallback(params, config, session) {
    const error = params.get('error');
    if (error) {
      throw createOAuthError(
        error,
        params.get('error_description') ?? 'OAuth error'
      );
    }

    if (spec.sessionOptions.useState) {
      const returnedState = params.get('state');
      if (returnedState !== session.state) {
        throw createOAuthError('state_mismatch', 'OAuth state validation failed');
      }
    }

    const code = params.get('code');
    if (!code) {
      throw createOAuthError('missing_code', 'No authorization code in callback');
    }

    const tokens = await spec.exchangeToken(code, config, session);
    const patientId = spec.extractPatientId(tokens);

    return { ...tokens, patientId };
  },

  async refresh(tokens, config) {
    return spec.refreshToken(tokens, config);
  },

  isExpired(tokens, bufferSeconds = 60) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return tokens.expiresAt <= nowSeconds + bufferSeconds;
  },

  canRefresh(tokens) {
    return !!(tokens.refreshToken || tokens.clientId);
  },
});
