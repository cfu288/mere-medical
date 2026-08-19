import type {
  OAuthConfig,
  OAuthClient,
  AuthorizationRequestState,
  CoreTokenSet,
  WithRefreshToken,
} from '../types.js';
import { createOAuthError } from '../types.js';
import { generateAuthorizationRequestState } from '../session.js';
import { parseTokenResponse, validateCallback, isTokenExpired } from '../token-exchange.js';

// One gateway serves all practices and the sandbox (NextGen Patient API Auth Guide).
export const NEXTGEN_CONSTANTS = {
  AUTH_URL: 'https://fhir.nextgen.com/nge/prod/patient-oauth/authorize',
  TOKEN_URL: 'https://fhir.nextgen.com/nge/prod/patient-oauth/token',
  FHIR_BASE_URL: 'https://fhir.nextgen.com/nge/prod/fhir-api-r4/fhir/r4/',
} as const;

export type NextGenTokenSet = CoreTokenSet &
  Partial<WithRefreshToken> & {
    scope?: string;
    patientId: string;
  };

export interface NextGenClient extends OAuthClient<NextGenTokenSet> {
  canRefresh: (tokens: NextGenTokenSet) => boolean;
}

export interface NextGenApiEndpoints {
  token: string;
  refresh: string;
}

async function initiateAuth(
  config: OAuthConfig,
): Promise<{ url: string; session: AuthorizationRequestState }> {
  // NextGen documents no PKCE; scopes are configured portal-side (Patient API Auth Guide).
  const session = await generateAuthorizationRequestState({
    usePkce: false,
    useState: true,
    tenant: config.tenant,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
  });

  if (session.state) {
    params.set('state', session.state);
  }

  const authUrl = config.tenant?.authUrl ?? '';
  const url = `${authUrl}?${params}`;

  return { url, session };
}

async function fetchPatientId(
  fhirBaseUrl: string,
  accessToken: string,
): Promise<string> {
  const res = await fetch(`${fhirBaseUrl}Patient`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw createOAuthError(
      'patient_lookup_failed',
      `GET /Patient failed: ${res.status}`,
      await res.text(),
    );
  }

  const data = await res.json();
  const patientId =
    data.resourceType === 'Patient'
      ? data.id
      : data.entry?.find(
          (e: { resource?: { resourceType?: string; id?: string } }) =>
            e.resource?.resourceType === 'Patient',
        )?.resource?.id;

  if (!patientId) {
    throw createOAuthError('missing_patient', 'No Patient id in GET /Patient response');
  }

  return patientId;
}

function buildTokenResult(
  tokens: { accessToken: string; expiresAt: number; refreshToken?: string; scope?: string; raw: Record<string, unknown> },
  patientId: string,
): NextGenTokenSet {
  return {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
    refreshToken: tokens.refreshToken,
    scope: tokens.scope,
    patientId,
    raw: tokens.raw,
  };
}

export function createNextGenClientConfidential(
  apiEndpoints: NextGenApiEndpoints,
): NextGenClient {
  return {
    initiateAuth,

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);

      const res = await fetch(apiEndpoints.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: config.redirectUri,
        }),
      });
      const tokens = await parseTokenResponse(res);

      const patientId = await fetchPatientId(
        NEXTGEN_CONSTANTS.FHIR_BASE_URL,
        tokens.accessToken,
      );

      return buildTokenResult(tokens, patientId);
    },

    async refresh(tokens, _config) {
      if (!tokens.refreshToken) {
        throw createOAuthError('refresh_not_supported', 'No refresh token available');
      }

      const res = await fetch(apiEndpoints.refresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: tokens.refreshToken,
        }),
      });

      const newTokens = await parseTokenResponse(res);

      return {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
        refreshToken: newTokens.refreshToken ?? tokens.refreshToken,
        scope: newTokens.scope ?? tokens.scope,
        patientId: tokens.patientId,
        raw: newTokens.raw,
      };
    },

    isExpired: isTokenExpired,

    canRefresh(tokens) {
      return !!tokens.refreshToken;
    },
  };
}

export interface NextGenOAuthConfigOptions {
  clientId: string;
  publicUrl: string;
  redirectPath: string;
}

export function buildNextGenOAuthConfig(options: NextGenOAuthConfigOptions): OAuthConfig {
  return {
    clientId: options.clientId,
    redirectUri: new URL(options.redirectPath, options.publicUrl).toString(),
    scopes: [],
    tenant: {
      id: 'nextgen',
      name: 'NextGen',
      authUrl: NEXTGEN_CONSTANTS.AUTH_URL,
      tokenUrl: NEXTGEN_CONSTANTS.TOKEN_URL,
      fhirBaseUrl: NEXTGEN_CONSTANTS.FHIR_BASE_URL,
      fhirVersion: 'R4',
    },
  };
}
