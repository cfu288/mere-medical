import type { OAuthConfig, AuthorizationRequestState } from './types.js';
import { generateCodeChallenge, generateAuthorizationRequestState } from './session.js';

/**
 * Builds the authorization URL for SMART on FHIR OAuth flows. Includes PKCE
 * challenge if the session has a code verifier, and sets the FHIR server as
 * the audience parameter
 */
export async function buildStandardAuthUrl(
  config: OAuthConfig,
  session: AuthorizationRequestState,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    response_type: 'code',
  });

  if (config.tenant?.fhirBaseUrl) {
    params.set('aud', config.tenant.fhirBaseUrl);
  }

  if (session.state) {
    params.set('state', session.state);
  }

  if (session.codeVerifier) {
    const challenge = await generateCodeChallenge(session.codeVerifier);
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', 'S256');
  }

  const authUrl = config.tenant?.authUrl ?? '';
  return `${authUrl}?${params}`;
}

/**
 * Generates PKCE credentials and state, then builds the authorization URL.
 * Returns both the redirect URL and the session state that must be persisted
 * across the OAuth redirect to validate the callback.
 */
export async function initiateStandardAuth(
  config: OAuthConfig,
): Promise<{ url: string; session: AuthorizationRequestState }> {
  const session = await generateAuthorizationRequestState({
    usePkce: true,
    useState: true,
    tenant: config.tenant,
  });
  const url = await buildStandardAuthUrl(config, session);
  return { url, session };
}
