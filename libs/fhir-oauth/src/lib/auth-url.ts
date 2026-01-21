import type { OAuthConfig, AuthorizationRequestState } from './types.js';
import { generateCodeChallenge } from './session.js';

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
