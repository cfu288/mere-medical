import type {
  OAuthConfig,
  AuthorizationRequestState,
  CoreTokenSet,
  WithIdToken,
} from '../types.js';
import { createOAuthError, OAuthErrors } from '../types.js';
import { generateAuthorizationRequestState } from '../session.js';
import { parseTokenResponse, isTokenExpired } from '../token-exchange.js';
import { parseJwtPayload } from '../jwt.js';

export const VERADIGM_DEFAULT_SCOPES = [
  'launch/patient',
  'openid',
  'profile',
  'user/*.read',
  'patient/*.read',
];

export type VeradigmTokenSet = CoreTokenSet &
  WithIdToken & {
    patientId: string;
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
  refresh: (tokens: VeradigmTokenSet, config: OAuthConfig) => Promise<VeradigmTokenSet>;
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

export function createVeradigmClient(): VeradigmClient {
  return {
    async initiateAuth(config) {
      const session = await generateAuthorizationRequestState({
        usePkce: false,
        useState: false,
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

      let authUrl = config.tenant?.authUrl ?? '';
      if (authUrl.endsWith('/')) {
        authUrl = authUrl.slice(0, -1);
      }

      const url = `${authUrl}?${params}`;
      return { url, session };
    },

    async handleCallback(params, config) {
      const error = params.get('error');
      if (error) {
        throw createOAuthError(
          error,
          params.get('error_description') ?? 'OAuth error',
        );
      }

      const code = params.get('code');
      if (!code) {
        throw OAuthErrors.missingCode();
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
        }),
      });

      const tokens = await parseTokenResponse(res);

      if (!tokens.idToken) {
        throw createOAuthError('missing_id_token', 'No id_token in token response');
      }

      const accessTokenPayload = parseJwtPayload<VeradigmAccessTokenPayload>(tokens.accessToken);
      const patientId = accessTokenPayload.local_patient_id;

      if (!patientId) {
        throw createOAuthError(
          'missing_patient',
          'No local_patient_id in access token JWT',
        );
      }

      return {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        idToken: tokens.idToken,
        patientId,
        raw: tokens.raw,
      };
    },

    async refresh() {
      throw createOAuthError(
        'refresh_not_supported',
        'Veradigm does not support refresh tokens - user must re-authenticate',
      );
    },

    isExpired: isTokenExpired,

    canRefresh() {
      return false;
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

export function buildVeradigmOAuthConfig(options: VeradigmOAuthConfigOptions): OAuthConfig {
  return {
    clientId: options.clientId,
    redirectUri: `${options.publicUrl}${options.redirectPath}`,
    scopes: options.scopes ?? VERADIGM_DEFAULT_SCOPES,
    tenant: {
      ...options.tenant,
      fhirVersion: 'DSTU2',
    },
  };
}
