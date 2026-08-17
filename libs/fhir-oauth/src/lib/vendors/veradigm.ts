import type {
  OAuthConfig,
  AuthorizationRequestState,
  CoreTokenSet,
  WithIdToken,
} from '../types.js';
import { createOAuthError, OAuthErrors } from '../types.js';
import {
  generateAuthorizationRequestState,
  generateCodeChallenge,
} from '../session.js';
import {
  parseTokenResponse,
  validateCallback,
  isTokenExpired,
} from '../token-exchange.js';
import { parseJwtPayload } from '../jwt.js';

export const VERADIGM_DEFAULT_SCOPES = [
  'launch/patient',
  'openid',
  'profile',
  'offline_access',
  'patient/*.rs',
];

export type VeradigmTokenSet = CoreTokenSet &
  WithIdToken & {
    patientId: string;
    refreshToken?: string;
  };

export interface VeradigmClient {
  initiateAuth: (
    config: OAuthConfig,
  ) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<VeradigmTokenSet>;
  refresh: (
    tokens: VeradigmTokenSet,
    config: OAuthConfig,
  ) => Promise<VeradigmTokenSet>;
  isExpired: (tokens: VeradigmTokenSet, bufferSeconds?: number) => boolean;
  canRefresh: (tokens: VeradigmTokenSet) => boolean;
}

interface VeradigmAccessTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  nbf: number;
  sub: string;
  fhir_api_id: string;
  global_patient_id: string;
  preferred_username: string;
  local_patient_id: string;
  client_id: string;
  scope: string[];
  auth_time: number;
  idp: string;
  amr: string[];
}

export function extractVeradigmPatientId(accessToken: string): string {
  const payload = parseJwtPayload<VeradigmAccessTokenPayload>(accessToken);
  if (!payload.local_patient_id) {
    throw createOAuthError(
      'missing_patient',
      'No local_patient_id in access token JWT',
    );
  }
  return payload.local_patient_id;
}

export function createVeradigmClient(): VeradigmClient {
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

      let authUrl = config.tenant?.authUrl ?? '';
      if (authUrl.endsWith('/')) {
        authUrl = authUrl.slice(0, -1);
      }

      const url = `${authUrl}?${params}`;
      return { url, session };
    },

    async handleCallback(params, config, session) {
      const code = validateCallback(params, session);

      if (!session.codeVerifier) {
        throw OAuthErrors.missingCodeVerifier();
      }

      if (!config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      let tokenUrl = config.tenant.tokenUrl;
      if (tokenUrl.endsWith('/')) {
        tokenUrl = tokenUrl.slice(0, -1);
      }

      const res = await fetch(tokenUrl, {
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

      const tokens = await parseTokenResponse(res);

      if (!tokens.idToken) {
        throw createOAuthError(
          'missing_id_token',
          'No id_token in token response',
        );
      }

      const patientId =
        typeof tokens.raw['patient'] === 'string'
          ? tokens.raw['patient']
          : extractVeradigmPatientId(tokens.accessToken);

      return {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        patientId,
        raw: tokens.raw,
      };
    },

    async refresh(tokens, config) {
      if (!tokens.refreshToken) {
        throw createOAuthError(
          'missing_refresh_token',
          'No refresh token available - user must re-authenticate',
        );
      }

      if (!config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      let tokenUrl = config.tenant.tokenUrl;
      if (tokenUrl.endsWith('/')) {
        tokenUrl = tokenUrl.slice(0, -1);
      }

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: config.clientId,
        }),
      });

      const newTokens = await parseTokenResponse(res);

      return {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
        idToken: newTokens.idToken ?? tokens.idToken,
        refreshToken: newTokens.refreshToken ?? tokens.refreshToken,
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

export interface VeradigmOAuthConfigOptions {
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
}

export function buildVeradigmOAuthConfig(
  options: VeradigmOAuthConfigOptions,
): OAuthConfig {
  return {
    clientId: options.clientId,
    redirectUri: `${options.publicUrl}${options.redirectPath}`,
    scopes: options.scopes ?? VERADIGM_DEFAULT_SCOPES,
    tenant: {
      ...options.tenant,
      fhirVersion: 'R4',
    },
  };
}

/**
 * References
 * https://developer.veradigm.com/Fhir/Introduction
 * https://developer.veradigm.com/Fhir/FHIR_Sandboxes
 * https://developer.veradigm.com/Fhir/EndpointDirectory
 * https://developer.veradigm.com/Fhir/SMARTonFHIR
 * https://developer.veradigm.com/Fhir/Resources
 * R4 endpoints: https://open.platform.veradigm.com/fhirendpoints/download/R4?endpointFilter=Patient
 */
