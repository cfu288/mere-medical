import type {
  OAuthConfig,
  AuthorizationRequestState,
  TokenSet,
} from './types.js';
import { createOAuthError, OAuthErrors } from './types.js';

/**
 * Validates OAuth callback parameters and returns the authorization code.
 * Checks for OAuth errors, validates state parameter against session, and
 * extracts the authorization code. Call this at the start of handleCallback
 * before performing token exchange.
 *
 * @throws OAuthError with code from the OAuth server if error param is present
 * @throws OAuthError with 'state_mismatch' if state doesn't match session
 * @throws OAuthError with 'missing_code' if no authorization code in params
 */
export function validateCallback(
  params: URLSearchParams,
  session: AuthorizationRequestState,
): string {
  const error = params.get('error');
  if (error) {
    throw createOAuthError(
      error,
      params.get('error_description') ?? 'OAuth error',
    );
  }

  const returnedState = params.get('state');
  if (returnedState !== session.state) {
    throw OAuthErrors.stateMismatch();
  }

  const code = params.get('code');
  if (!code) {
    throw OAuthErrors.missingCode();
  }

  return code;
}

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
    throw OAuthErrors.missingCodeVerifier();
  }

  if (!config.tenant?.tokenUrl) {
    throw OAuthErrors.noTokenUrl();
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
    throw OAuthErrors.tokenExchangeFailed(res.status, errorText);
  }

  const data = await res.json();

  if (!data.access_token) {
    throw OAuthErrors.missingAccessToken();
  }

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

export function isTokenExpired(tokens: TokenSet, bufferSeconds = 60): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return tokens.expiresAt <= nowSeconds + bufferSeconds;
}
