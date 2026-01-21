import type { OAuthConfig, AuthSession, TokenSet } from './types.js';
import { createOAuthError } from './types.js';

export type TokenExchanger = (
  code: string,
  config: OAuthConfig,
  session: AuthSession
) => Promise<TokenSet>;

export const exchangeWithPkce: TokenExchanger = async (code, config, session) => {
  if (!session.codeVerifier) {
    throw createOAuthError(
      'missing_code_verifier',
      'PKCE code verifier not found in session'
    );
  }

  const res = await fetch(config.tenant!.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: session.codeVerifier,
    }),
  });

  return parseTokenResponse(res);
};

export const exchangeNoPkce: TokenExchanger = async (code, config) => {
  const res = await fetch(config.tenant!.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  return parseTokenResponse(res);
};

export const exchangeViaProxy =
  (proxyUrlBuilder: (config: OAuthConfig) => string): TokenExchanger =>
  async (code, config, session) => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
    });

    if (session.codeVerifier) {
      body.set('code_verifier', session.codeVerifier);
    }

    const res = await fetch(proxyUrlBuilder(config), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    return parseTokenResponse(res);
  };

export const exchangeAtFixedEndpoint =
  (tokenEndpoint: string): TokenExchanger =>
  async (code, config, session) => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
    });

    if (session.codeVerifier) {
      body.set('code_verifier', session.codeVerifier);
    }

    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    return parseTokenResponse(res);
  };

export const parseTokenResponse = async (res: Response): Promise<TokenSet> => {
  if (!res.ok) {
    const errorText = await res.text();
    throw createOAuthError(
      'token_exchange_failed',
      `Token exchange failed: ${res.status}`,
      errorText
    );
  }

  const data = await res.json();
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    accessToken: data.access_token,
    expiresAt: nowSeconds + (data.expires_in ?? 3600),
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    scope: data.scope,
    raw: data,
  };
};
