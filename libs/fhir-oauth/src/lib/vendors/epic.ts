import { createOAuthClient, type OAuthClient } from '../client.js';
import { buildStandardAuthUrl } from '../auth-url.js';
import { exchangeWithPkce, exchangeViaProxy } from '../token-exchange.js';
import {
  jwtBearerRefresh,
  noRefresh,
  conditionalRefresh,
  type JwtSigner,
} from '../token-refresh.js';
import { patientIdFromResponse } from '../patient-id.js';
import { createOAuthError } from '../types.js';

export interface EpicClientDependencies {
  signJwt: JwtSigner;
}

export const createEpicClient = (deps: EpicClientDependencies): OAuthClient => {
  const { signJwt } = deps;

  return createOAuthClient({
    sessionOptions: { usePkce: true, useState: true },
    buildAuthUrl: buildStandardAuthUrl,
    exchangeToken: exchangeWithPkce,
    extractPatientId: patientIdFromResponse('patient'),
    refreshToken: conditionalRefresh(
      (tokens) => !!tokens.clientId,
      jwtBearerRefresh(signJwt),
      noRefresh
    ),
  });
};

export const createEpicClientWithProxy = (
  deps: EpicClientDependencies,
  proxyUrlBuilder: (tenantId: string, targetType: 'token' | 'register') => string
): OAuthClient => {
  const { signJwt } = deps;

  return createOAuthClient({
    sessionOptions: { usePkce: true, useState: true },
    buildAuthUrl: buildStandardAuthUrl,
    exchangeToken: (code, config, session) => {
      const useProxy = !!config.tenant?.id;
      if (useProxy) {
        return exchangeViaProxy(() => proxyUrlBuilder(config.tenant!.id, 'token'))(
          code,
          config,
          session
        );
      }
      return exchangeWithPkce(code, config, session);
    },
    extractPatientId: patientIdFromResponse('patient'),
    refreshToken: conditionalRefresh(
      (tokens) => !!tokens.clientId,
      jwtBearerRefresh({
        signJwt,
        proxyUrlBuilder: (config) =>
          config.tenant?.id
            ? proxyUrlBuilder(config.tenant.id, 'token')
            : config.tenant!.tokenUrl,
      }),
      noRefresh
    ),
  });
};

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

export const registerEpicDynamicClient = async (
  accessToken: string,
  baseUrl: string,
  softwareId: string,
  publicKey: PublicKeyWithKid,
  options?: DynamicClientRegistrationOptions
): Promise<{ clientId: string }> => {
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
        'This Epic instance does not support dynamic client registration'
      );
    }
    throw createOAuthError(
      'dcr_failed',
      `Dynamic client registration failed: ${res.status}`
    );
  }

  const data = await res.json();
  return { clientId: data.client_id };
};
