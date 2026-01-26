import type {
  OAuthConfig,
  AuthorizationRequestState,
  CoreTokenSet,
  WithIdToken,
  WithRefreshToken,
} from '../types.js';
import { createOAuthError, OAuthErrors } from '../types.js';
import {
  generateAuthorizationRequestState,
  generateCodeChallenge,
} from '../session.js';
import { parseTokenResponse, validateCallback, isTokenExpired } from '../token-exchange.js';
import { parseJwtPayload } from '../jwt.js';

export const HEALOW_DEFAULT_SCOPES = [
  'openid',
  'fhirUser',
  'patient/AllergyIntolerance.read',
  'patient/CarePlan.read',
  'patient/CareTeam.read',
  'patient/Condition.read',
  'patient/Device.read',
  'patient/DiagnosticReport.read',
  'patient/DocumentReference.read',
  'patient/Binary.read',
  'patient/Encounter.read',
  'patient/Goal.read',
  'patient/Immunization.read',
  'patient/MedicationAdministration.read',
  'patient/MedicationRequest.read',
  'patient/Observation.read',
  'patient/Organization.read',
  'patient/Patient.read',
  'patient/Practitioner.read',
  'patient/PractitionerRole.read',
  'patient/Procedure.read',
  'patient/Provenance.read',
  'patient/Medication.read',
  'patient/Location.read',
];

export type HealowTokenSet = CoreTokenSet &
  WithIdToken &
  Partial<WithRefreshToken> & {
    scope?: string;
    tenantId: string;
  };

export interface HealowClientConfig {
  mode: 'public' | 'confidential';
  apiEndpoints?: {
    token: string;
    refresh: string;
  };
  proxyUrlBuilder?: (tenantId: string, targetType: 'token' | 'base') => string;
}

export interface HealowClient {
  initiateAuth: (
    config: OAuthConfig,
  ) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<HealowTokenSet>;
  refresh: (tokens: HealowTokenSet, config: OAuthConfig) => Promise<HealowTokenSet>;
  isExpired: (tokens: HealowTokenSet, bufferSeconds?: number) => boolean;
  canRefresh: (tokens: HealowTokenSet) => boolean;
}

interface HealowIdTokenPayload {
  sub: string;
  aud: string;
  profile: string;
  iss: string;
  name: string;
  exp: number;
  iat: number;
  fhirUser: string;
  email: string;
}

export function extractPatientIdFromIdToken(idToken: string): string {
  const payload = parseJwtPayload<HealowIdTokenPayload>(idToken);
  const fhirUser = payload.fhirUser;
  if (!fhirUser) {
    throw createOAuthError('missing_fhir_user', 'No fhirUser claim in id_token');
  }
  return fhirUser.split('/').slice(-1)[0];
}

export function createHealowClient(clientConfig: HealowClientConfig): HealowClient {
  const { mode, apiEndpoints, proxyUrlBuilder } = clientConfig;

  return {
    async initiateAuth(config) {
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
    },

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);

      if (!session.codeVerifier) {
        throw OAuthErrors.missingCodeVerifier();
      }

      const tenantId = config.tenant?.id;
      if (!tenantId) {
        throw createOAuthError('missing_tenant_id', 'Tenant ID is required');
      }

      let tokens;

      if (mode === 'confidential' && apiEndpoints?.token) {
        const res = await fetch(apiEndpoints.token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirect_uri: config.redirectUri,
            code_verifier: session.codeVerifier,
            tenant_id: tenantId,
          }),
        });
        tokens = await parseTokenResponse(res);
      } else if (proxyUrlBuilder) {
        const proxyUrl = proxyUrlBuilder(tenantId, 'token');
        const res = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.redirectUri,
            client_id: config.clientId,
            code_verifier: session.codeVerifier,
          }),
        });
        tokens = await parseTokenResponse(res);
      } else if (config.tenant?.tokenUrl) {
        const res = await fetch(config.tenant.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.redirectUri,
            client_id: config.clientId,
            code_verifier: session.codeVerifier,
          }),
        });
        tokens = await parseTokenResponse(res);
      } else {
        throw OAuthErrors.noTokenUrl();
      }

      if (!tokens.idToken) {
        throw createOAuthError('missing_id_token', 'No id_token in token response');
      }

      return {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        scope: tokens.scope,
        tenantId,
        raw: tokens.raw,
      };
    },

    async refresh(tokens, config) {
      if (!tokens.refreshToken) {
        throw createOAuthError(
          'refresh_not_supported',
          mode === 'public'
            ? 'Public client mode does not support refresh tokens - user must re-authenticate'
            : 'No refresh token available',
        );
      }

      let res: Response;

      if (mode === 'confidential' && apiEndpoints?.refresh) {
        res = await fetch(apiEndpoints.refresh, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refresh_token: tokens.refreshToken,
            tenant_id: tokens.tenantId,
          }),
        });
      } else if (proxyUrlBuilder) {
        const proxyUrl = proxyUrlBuilder(tokens.tenantId, 'token');
        res = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
            client_id: config.clientId,
          }),
        });
      } else if (config.tenant?.tokenUrl) {
        res = await fetch(config.tenant.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
            client_id: config.clientId,
          }),
        });
      } else {
        throw OAuthErrors.noTokenUrl();
      }

      const newTokens = await parseTokenResponse(res);

      return {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
        idToken: newTokens.idToken ?? tokens.idToken,
        refreshToken: newTokens.refreshToken ?? tokens.refreshToken,
        scope: newTokens.scope ?? tokens.scope,
        tenantId: tokens.tenantId,
        raw: newTokens.raw,
      };
    },

    isExpired: isTokenExpired,

    canRefresh(tokens) {
      return mode === 'confidential' && !!tokens.refreshToken;
    },
  };
}

export interface HealowOAuthConfigOptions {
  clientId: string;
  publicUrl: string;
  redirectPath: string;
  scopes?: string[];
  tenant: {
    id: string;
    name: string;
    authUrl: string;
    tokenUrl: string;
    fhirBaseUrl: string;
  };
  confidentialMode?: boolean;
}

export function buildHealowOAuthConfig(options: HealowOAuthConfigOptions): OAuthConfig {
  const scopes = options.scopes ?? [...HEALOW_DEFAULT_SCOPES];

  if (options.confidentialMode && !scopes.includes('offline_access')) {
    scopes.push('offline_access');
  }

  return {
    clientId: options.clientId,
    redirectUri: `${options.publicUrl}${options.redirectPath}`,
    scopes,
    tenant: {
      ...options.tenant,
      fhirVersion: 'R4',
    },
  };
}
