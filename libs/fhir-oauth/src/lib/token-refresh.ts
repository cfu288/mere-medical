import type { OAuthConfig, TokenSet } from './types.js';
import { createOAuthError } from './types.js';
import { parseTokenResponse } from './token-exchange.js';

export type TokenRefresher = (
  tokens: TokenSet,
  config: OAuthConfig
) => Promise<TokenSet>;

export const noRefresh: TokenRefresher = async () => {
  throw createOAuthError(
    'refresh_not_supported',
    'This connection does not support token refresh'
  );
};

export const standardRefresh: TokenRefresher = async (tokens, config) => {
  if (!tokens.refreshToken) {
    throw createOAuthError('no_refresh_token', 'No refresh token available');
  }

  const res = await fetch(config.tenant!.tokenUrl, {
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
    refreshToken: newTokens.refreshToken ?? tokens.refreshToken,
    idToken: newTokens.idToken ?? tokens.idToken,
    patientId: newTokens.patientId ?? tokens.patientId,
    clientId: tokens.clientId,
  };
};

export const standardRefreshAtFixedEndpoint =
  (tokenEndpoint: string): TokenRefresher =>
  async (tokens) => {
    if (!tokens.refreshToken) {
      throw createOAuthError('no_refresh_token', 'No refresh token available');
    }

    const res = await fetch(tokenEndpoint, {
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
      refreshToken: newTokens.refreshToken ?? tokens.refreshToken,
      idToken: newTokens.idToken ?? tokens.idToken,
      patientId: newTokens.patientId ?? tokens.patientId,
    };
  };

export type JwtPayload = Record<string, string | number | boolean | object>;

export type JwtSigner = (payload: JwtPayload) => Promise<string>;

export interface JwtBearerRefreshOptions {
  signJwt: JwtSigner;
  proxyUrlBuilder?: (config: OAuthConfig) => string;
}

export const jwtBearerRefresh =
  (signJwtOrOptions: JwtSigner | JwtBearerRefreshOptions): TokenRefresher =>
  async (tokens, config) => {
    const { signJwt, proxyUrlBuilder } =
      typeof signJwtOrOptions === 'function'
        ? { signJwt: signJwtOrOptions, proxyUrlBuilder: undefined }
        : signJwtOrOptions;

    if (!tokens.clientId) {
      throw createOAuthError(
        'no_client_id',
        'No dynamic client registered - cannot refresh'
      );
    }

    const tokenUrl = proxyUrlBuilder
      ? proxyUrlBuilder(config)
      : config.tenant!.tokenUrl;

    const now = Math.floor(Date.now() / 1000);
    const assertion = await signJwt({
      sub: tokens.clientId,
      iss: tokens.clientId,
      aud: config.tenant!.tokenUrl,
      jti: crypto.randomUUID(),
      exp: now + 300,
      iat: now,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: tokens.clientId,
        assertion,
      }),
    });

    const newTokens = await parseTokenResponse(res);

    return {
      ...newTokens,
      idToken: newTokens.idToken ?? tokens.idToken,
      patientId: tokens.patientId,
      clientId: tokens.clientId,
    };
  };

export const conditionalRefresh =
  (
    condition: (tokens: TokenSet) => boolean,
    ifTrue: TokenRefresher,
    ifFalse: TokenRefresher
  ): TokenRefresher =>
  async (tokens, config) => {
    return condition(tokens) ? ifTrue(tokens, config) : ifFalse(tokens, config);
  };
