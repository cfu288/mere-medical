import type { OAuthConfig, AuthSession } from './types.js';
import { generateCodeChallenge } from './session.js';

export type AuthUrlBuilder = (
  config: OAuthConfig,
  session: AuthSession
) => Promise<string>;

export const buildStandardAuthUrl: AuthUrlBuilder = async (config, session) => {
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
};

export const buildFixedEndpointAuthUrl =
  (authEndpoint: string): AuthUrlBuilder =>
  async (config, session) => {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
    });

    if (session.state) {
      params.set('state', session.state);
    }

    if (session.codeVerifier) {
      const challenge = await generateCodeChallenge(session.codeVerifier);
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }

    return `${authEndpoint}?${params}`;
  };
