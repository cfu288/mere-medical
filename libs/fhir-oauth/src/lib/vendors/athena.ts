import type {
  OAuthConfig,
  AuthorizationRequestState,
  CoreTokenSet,
  WithRefreshToken,
} from '../types.js';
import { createOAuthError, OAuthErrors } from '../types.js';
import {
  generateAuthorizationRequestState,
  generateCodeChallenge,
} from '../session.js';
import { parseTokenResponse, validateCallback, isTokenExpired } from '../token-exchange.js';

export const ATHENA_DEFAULT_SCOPES = [
  'openid',
  'fhirUser',
  'offline_access',
  'launch/patient',
  'patient/AllergyIntolerance.r',
  'patient/Binary.r',
  'patient/CarePlan.r',
  'patient/CareTeam.r',
  'patient/Condition.r',
  'patient/Coverage.r',
  'patient/Device.r',
  'patient/DiagnosticReport.r',
  'patient/DocumentReference.r',
  'patient/Encounter.r',
  'patient/Goal.r',
  'patient/Immunization.r',
  'patient/Location.r',
  'patient/Medication.r',
  'patient/MedicationDispense.r',
  'patient/MedicationRequest.r',
  'patient/Observation.r',
  'patient/Organization.r',
  'patient/Patient.r',
  'patient/Practitioner.r',
  'patient/Procedure.r',
  'patient/Provenance.r',
  'patient/RelatedPerson.r',
  'patient/ServiceRequest.r',
  'patient/Specimen.r',
];

export type AthenaTokenSet = CoreTokenSet &
  Partial<WithRefreshToken> & {
    patientId: string;
    idToken?: string;
    scope?: string;
  };

export interface AthenaClient {
  initiateAuth: (
    config: OAuthConfig,
  ) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<AthenaTokenSet>;
  refresh: (tokens: AthenaTokenSet, config: OAuthConfig) => Promise<AthenaTokenSet>;
  isExpired: (tokens: AthenaTokenSet, bufferSeconds?: number) => boolean;
  canRefresh: (tokens: AthenaTokenSet) => boolean;
}

async function initiateAuth(
  config: OAuthConfig,
): Promise<{ url: string; session: AuthorizationRequestState }> {
  const session = await generateAuthorizationRequestState({
    usePkce: true,
    useState: true,
    tenant: config.tenant,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
  });

  if (!config.tenant?.fhirBaseUrl) {
    throw createOAuthError('missing_aud', 'fhirBaseUrl is required for aud parameter');
  }
  params.set('aud', config.tenant.fhirBaseUrl);

  if (session.state) {
    params.set('state', session.state);
  }

  if (session.codeVerifier) {
    const challenge = await generateCodeChallenge(session.codeVerifier);
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', 'S256');
  }

  const authUrl = config.tenant?.authUrl ?? '';
  const url = `${authUrl}?${params}`;

  return { url, session };
}

function validateAndExtractCode(
  params: URLSearchParams,
  config: OAuthConfig,
  session: AuthorizationRequestState,
): { code: string; codeVerifier: string } {
  const code = validateCallback(params, session);

  if (!session.codeVerifier) {
    throw OAuthErrors.missingCodeVerifier();
  }

  return { code, codeVerifier: session.codeVerifier };
}

function buildTokenResult(
  tokens: { accessToken: string; expiresAt: number; idToken?: string; refreshToken?: string; scope?: string; raw: Record<string, unknown> },
  patientId: string,
): AthenaTokenSet {
  return {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    scope: tokens.scope,
    patientId,
    raw: tokens.raw,
  };
}

export function createAthenaClient(): AthenaClient {
  return {
    initiateAuth,

    async handleCallback(params, config, session) {
      const { code, codeVerifier } = validateAndExtractCode(params, config, session);

      if (!config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      const res = await fetch(config.tenant.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri,
          client_id: config.clientId,
          code_verifier: codeVerifier,
        }),
      });
      const tokens = await parseTokenResponse(res);

      const patientId = tokens.raw['patient'] as string | undefined;
      if (!patientId) {
        throw createOAuthError('missing_patient', 'No patient ID in token response');
      }

      return buildTokenResult(tokens, patientId);
    },

    async refresh(tokens, _config) {
      if (!tokens.refreshToken) {
        throw createOAuthError('refresh_not_supported', 'No refresh token available');
      }

      if (!_config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      const res = await fetch(_config.tenant.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: _config.clientId,
        }),
      });

      const newTokens = await parseTokenResponse(res);

      return {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
        idToken: newTokens.idToken ?? tokens.idToken,
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

export interface AthenaOAuthConfigOptions {
  clientId: string;
  publicUrl: string;
  redirectPath: string;
  scopes?: string[];
  environment: 'preview' | 'production';
}

const ATHENA_ENVIRONMENTS = {
  preview: {
    authUrl: 'https://api.preview.platform.athenahealth.com/oauth2/v1/authorize',
    tokenUrl: 'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
    fhirBaseUrl: 'https://api.preview.platform.athenahealth.com/fhir/r4',
  },
  production: {
    authUrl: 'https://api.platform.athenahealth.com/oauth2/v1/authorize',
    tokenUrl: 'https://api.platform.athenahealth.com/oauth2/v1/token',
    fhirBaseUrl: 'https://api.platform.athenahealth.com/fhir/r4',
  },
};

export function buildAthenaOAuthConfig(options: AthenaOAuthConfigOptions): OAuthConfig {
  const scopes = options.scopes ?? [...ATHENA_DEFAULT_SCOPES];
  const env = ATHENA_ENVIRONMENTS[options.environment];

  return {
    clientId: options.clientId,
    redirectUri: `${options.publicUrl}${options.redirectPath}`,
    scopes,
    tenant: {
      id: options.environment,
      name: 'athenahealth',
      authUrl: env.authUrl,
      tokenUrl: env.tokenUrl,
      fhirBaseUrl: env.fhirBaseUrl,
      fhirVersion: 'R4',
    },
  };
}

export function getAthenaEnvironmentConfig(environment: 'preview' | 'production') {
  return ATHENA_ENVIRONMENTS[environment];
}
