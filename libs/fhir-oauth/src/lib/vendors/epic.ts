import type { OAuthConfig, AuthorizationRequestState, TokenSet } from '../types.js';
import { createOAuthError } from '../types.js';
import { initiateStandardAuth } from '../auth-url.js';
import { exchangeWithPkce, parseTokenResponse, validateCallback, isTokenExpired } from '../token-exchange.js';

export type JwtSigner = (
  payload: Record<string, string | number | boolean | object>,
) => Promise<string>;

export interface EpicClientDependencies {
  signJwt: JwtSigner;
}

export interface EpicClient {
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

/**
 * Creates an OAuth client for Epic FHIR servers. Handles Epic's SMART on FHIR
 * flow including PKCE and JWT bearer token refresh for dynamically registered
 * clients. Use this when making direct requests to Epic's token endpoint.
 *
 * @param deps.signJwt - Function to sign JWTs for client authentication
 */
export function createEpicClient(deps: EpicClientDependencies): EpicClient {
  const { signJwt } = deps;

  return {
    initiateAuth: initiateStandardAuth,

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);
      const tokens = await exchangeWithPkce(code, config, session);

      const patientId = tokens.raw['patient'] as string | undefined;
      if (!patientId) {
        throw createOAuthError(
          'missing_patient',
          'No patient field in token response',
        );
      }

      return { ...tokens, patientId };
    },

    async refresh(tokens, config) {
      if (!tokens.clientId) {
        throw createOAuthError(
          'refresh_not_supported',
          'No dynamic client registered - cannot refresh without clientId',
        );
      }

      if (!config.tenant?.tokenUrl) {
        throw createOAuthError('no_token_url', 'No token URL provided');
      }

      const now = Math.floor(Date.now() / 1000);
      const assertion = await signJwt({
        sub: tokens.clientId,
        iss: tokens.clientId,
        aud: config.tenant.tokenUrl,
        jti: crypto.randomUUID(),
        exp: now + 300,
        iat: now,
      });

      const res = await fetch(config.tenant.tokenUrl, {
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
    },

    isExpired: isTokenExpired,
  };
}

/**
 * Creates an OAuth client for Epic that routes token requests through a proxy.
 * Use this in browser environments where direct requests to Epic's token endpoint
 * would be blocked by CORS, or when you need server-side request handling.
 *
 * @param deps.signJwt - Function to sign JWTs for client authentication
 * @param proxyUrlBuilder - Returns the proxy URL for a given tenant and request type
 *
 * @example
 * const client = createEpicClientWithProxy(
 *   { signJwt: myJwtSigner },
 *   (tenantId, targetType) => `/api/proxy?serviceId=${tenantId}&target_type=${targetType}`
 * );
 *
 * // When tenantId='epic_r4' and targetType='token':
 * // proxyUrlBuilder returns '/api/proxy?serviceId=epic_r4&target_type=token'
 *
 * const { url, session } = await client.initiateAuth(config);
 * // User redirected to Epic login, then back to your app with ?code=...
 *
 * const tokens = await client.handleCallback(params, config, session);
 * // tokens: { accessToken, refreshToken, patientId, ... }
 */
export function createEpicClientWithProxy(
  deps: EpicClientDependencies,
  proxyUrlBuilder: (
    tenantId: string,
    targetType: 'token' | 'register',
  ) => string,
): EpicClient {
  const { signJwt } = deps;

  return {
    initiateAuth: initiateStandardAuth,

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);

      let tokens: TokenSet;
      if (config.tenant?.id) {
        const proxyUrl = proxyUrlBuilder(config.tenant.id, 'token');
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          code,
        });
        if (session.codeVerifier) {
          body.set('code_verifier', session.codeVerifier);
        }

        const res = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        tokens = await parseTokenResponse(res);
      } else {
        tokens = await exchangeWithPkce(code, config, session);
      }

      const patientId = tokens.raw['patient'] as string | undefined;
      if (!patientId) {
        throw createOAuthError(
          'missing_patient',
          'No patient field in token response',
        );
      }

      return { ...tokens, patientId };
    },

    async refresh(tokens, config) {
      if (!tokens.clientId) {
        throw createOAuthError(
          'refresh_not_supported',
          'No dynamic client registered - cannot refresh without clientId',
        );
      }

      if (!config.tenant?.tokenUrl) {
        throw createOAuthError('no_token_url', 'No token URL provided');
      }

      const tokenUrl = config.tenant.id
        ? proxyUrlBuilder(config.tenant.id, 'token')
        : config.tenant.tokenUrl;

      const now = Math.floor(Date.now() / 1000);
      const assertion = await signJwt({
        sub: tokens.clientId,
        iss: tokens.clientId,
        aud: config.tenant.tokenUrl,
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
    },

    isExpired: isTokenExpired,
  };
}

export interface PublicKeyWithKid {
  kty: string;
  e: string;
  n: string;
  kid: string;
}

export interface DynamicClientRegistrationOptions {
  useProxy?: boolean;
  proxyUrl?: string;
}

/**
 * Registers a dynamic client with Epic using the SMART Backend Services spec.
 * Call this after initial authorization to get a persistent client_id that can
 * be used for JWT bearer token refresh without requiring user interaction.
 *
 * @param accessToken - Access token from the initial authorization
 * @param baseUrl - Epic FHIR server base URL
 * @param softwareId - Your application's software ID registered with Epic
 * @param publicKey - RSA public key for client authentication
 * @param options.useProxy - Route registration through a proxy
 * @param options.proxyUrl - Proxy URL for registration requests
 * @returns The registered client_id
 */
export async function registerEpicDynamicClient(
  accessToken: string,
  baseUrl: string,
  softwareId: string,
  publicKey: PublicKeyWithKid,
  options?: DynamicClientRegistrationOptions,
): Promise<{ clientId: string }> {
  const registerUrl =
    options?.useProxy && options?.proxyUrl
      ? options.proxyUrl
      : `${baseUrl.replace(/\/api\/FHIR\/(DSTU2|R4)\/?/, '')}/oauth2/register`;

  const res = await fetch(registerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      software_id: softwareId,
      jwks: {
        keys: [
          {
            e: publicKey.e,
            kty: publicKey.kty,
            n: publicKey.n,
            kid: publicKey.kid,
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw createOAuthError(
        'dcr_not_supported',
        'This Epic instance does not support dynamic client registration',
      );
    }
    throw createOAuthError(
      'dcr_failed',
      `Dynamic client registration failed: ${res.status}`,
    );
  }

  const data = await res.json();
  return { clientId: data.client_id };
}
