/**
 * Athena Health OAuth 2.0 + FHIR client implementation.
 *
 * Athena uses a global FHIR endpoint but requires practice context via the `ah-practice`
 * query parameter on FHIR API calls: `?ah-practice=Organization/{ahPractice}`
 *
 * Preview (Sandbox) Test Patient Login:
 * - Practice ID: 80000
 * - Patient ID: 14545
 * - Email: phrtest_preview@mailinator.com
 * - Password: Password1
 *
 * @see https://docs.athenahealth.com/api/guides/authorize-endpoint
 * @see https://docs.athenahealth.com/api/guides/token-endpoint
 * @see https://docs.athenahealth.com/api/guides/base-fhir-urls
 * @see https://docs.athenahealth.com/api/guides/testing-sandbox
 */
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
import { parseJwtPayload } from '../jwt.js';

export const ATHENA_DEFAULT_SCOPES = [
  'openid',
  'fhirUser',
  'offline_access',
  'launch/patient',
  'patient/AllergyIntolerance.read',
  'patient/Binary.read',
  'patient/CarePlan.read',
  'patient/CareTeam.read',
  'patient/Condition.read',
  'patient/Device.read',
  'patient/DiagnosticReport.read',
  'patient/DocumentReference.read',
  'patient/Encounter.read',
  'patient/Goal.read',
  'patient/Immunization.read',
  'patient/Location.read',
  'patient/Medication.read',
  'patient/MedicationRequest.read',
  'patient/Observation.read',
  'patient/Organization.read',
  'patient/Patient.read',
  'patient/Practitioner.read',
  'patient/Procedure.read',
  'patient/Provenance.read',
  'patient/ServiceRequest.read',
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

/**
 * Builds the authorization URL for Athena OAuth flow.
 *
 * Authorization Request Parameters (sent as query string):
 * - client_id: Application client ID
 * - redirect_uri: Callback URL for authorization code
 * - response_type: 'code' for authorization code flow
 * - scope: Space-delimited list of requested scopes
 * - aud: FHIR base URL (required by Athena)
 * - state: CSRF protection token
 * - nonce: Replay protection for ID token (required with openid scope)
 * - code_challenge: PKCE challenge (S256)
 * - code_challenge_method: 'S256'
 *
 * @see https://docs.athenahealth.com/api/guides/authorize-endpoint
 */
async function initiateAuth(
  config: OAuthConfig,
): Promise<{ url: string; session: AuthorizationRequestState }> {
  // Nonce is required when requesting the openid scope per OpenID Connect spec.
  const session = await generateAuthorizationRequestState({
    usePkce: true,
    useState: true,
    useNonce: true,
    tenant: config.tenant,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
  });

  // Athena requires the aud parameter to be the FHIR base URL.
  if (!config.tenant?.fhirBaseUrl) {
    throw createOAuthError('missing_aud', 'fhirBaseUrl is required for aud parameter');
  }
  params.set('aud', config.tenant.fhirBaseUrl);

  if (session.state) {
    params.set('state', session.state);
  }

  if (session.nonce) {
    params.set('nonce', session.nonce);
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
  _config: OAuthConfig,
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

    /**
     * Exchanges authorization code for tokens.
     *
     * Token Request (application/x-www-form-urlencoded):
     * - grant_type: 'authorization_code'
     * - code: Authorization code from callback
     * - redirect_uri: Must match the original authorization request
     * - client_id: Application client ID
     * - code_verifier: PKCE code verifier
     *
     * Token Response:
     * - access_token: Bearer token for FHIR API requests
     * - token_type: 'Bearer'
     * - expires_in: Token lifetime in seconds
     * - scope: Granted scopes (space-delimited)
     * - id_token: OpenID Connect ID token (contains nonce claim)
     * - refresh_token: Token for obtaining new access tokens (if offline_access scope granted)
     * - patient: Patient FHIR ID for the authorized context
     * - ah_practice: Practice context required for FHIR API calls (e.g., "a-1.Practice-80000")
     *
     * @see https://docs.athenahealth.com/api/guides/token-endpoint
     */
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

      if (!tokens.idToken) {
        throw createOAuthError('missing_id_token', 'No ID token in response');
      }

      if (!session.nonce) {
        throw createOAuthError('missing_nonce', 'Nonce was not set in session');
      }

      const payload = parseJwtPayload<{ nonce?: string }>(tokens.idToken);
      if (payload.nonce !== session.nonce) {
        throw OAuthErrors.nonceMismatch();
      }

      const patientId = tokens.raw['patient'] as string | undefined;
      if (!patientId) {
        throw createOAuthError('missing_patient', 'No patient ID in token response');
      }

      return buildTokenResult(tokens, patientId);
    },

    /**
     * Refreshes an expired access token.
     *
     * Refresh Token Request (application/x-www-form-urlencoded):
     * - grant_type: 'refresh_token'
     * - refresh_token: The refresh token from the original token response
     * - client_id: Application client ID
     * - scope: Originally granted scopes (required by Athena)
     *
     * Refresh Token Response:
     * - access_token: New bearer token
     * - token_type: 'Bearer'
     * - expires_in: Token lifetime in seconds
     * - scope: Granted scopes
     * - refresh_token: New refresh token (if provided, replaces the old one)
     *
     * @see https://docs.athenahealth.com/api/guides/token-endpoint
     */
    async refresh(tokens, _config) {
      if (!tokens.refreshToken) {
        throw createOAuthError('refresh_not_supported', 'No refresh token available');
      }

      if (!_config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      // Athena requires scope in refresh requests.
      if (!tokens.scope) {
        throw createOAuthError('missing_scope', 'Scope is required for token refresh');
      }

      const res = await fetch(_config.tenant.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: _config.clientId,
          scope: tokens.scope,
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

/**
 * @see https://docs.athenahealth.com/api/guides/base-fhir-urls
 */
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
