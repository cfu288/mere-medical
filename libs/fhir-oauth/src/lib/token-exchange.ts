import type {
  OAuthConfig,
  AuthorizationRequestState,
  TokenSet,
} from './types.js';
import { createOAuthError } from './types.js';

/**
 * Exchanges an authorization code for tokens using PKCE. Requires a code
 * verifier in the session that matches the challenge sent during authorization.
 *
 * @param code - Authorization code from the callback URL query params
 * @param config - OAuth configuration with clientId, redirectUri, and tenant
 * @param session - Authorization state containing the PKCE code verifier
 * @returns TokenSet with access token, expiration, and optional refresh/id tokens
 * @throws OAuthError if code verifier is missing or token exchange fails
 */
export async function exchangeWithPkce(
  code: string,
  config: OAuthConfig,
  session: AuthorizationRequestState,
): Promise<TokenSet> {
  if (!session.codeVerifier) {
    throw createOAuthError(
      'missing_code_verifier',
      'PKCE code verifier not found in session',
    );
  }

  if (!config.tenant?.tokenUrl) {
    throw createOAuthError('no_token_url', 'OAuth token URL not provided');
  }

  const res = await fetch(config.tenant.tokenUrl, {
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
}

/**
 * Parses an OAuth token endpoint response into a TokenSet.
 *
 * @param res - Fetch Response from the token endpoint
 * @returns TokenSet with access token, expiration, and optional refresh/id tokens
 * @throws OAuthError on non-2xx responses, with the error body as the cause
 */
export async function parseTokenResponse(res: Response): Promise<TokenSet> {
  if (!res.ok) {
    const errorText = await res.text();
    throw createOAuthError(
      'token_exchange_failed',
      `Token exchange failed: ${res.status}`,
      errorText,
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
}
