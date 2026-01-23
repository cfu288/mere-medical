import type {
  OAuthConfig,
  AuthorizationRequestState,
  CoreTokenSet,
  WithPatientId,
} from '../types.js';
import { createOAuthError, OAuthErrors } from '../types.js';
import {
  generateAuthorizationRequestState,
  generateCodeChallenge,
} from '../session.js';
import {
  exchangeWithPkce,
  parseTokenResponse,
  validateCallback,
  isTokenExpired,
} from '../token-exchange.js';

/**
 * VA Patient Health API token responses include a patient field when the
 * launch/patient scope is requested. Per VA docs: "A permission setting to
 * obtain the patient's identifier in the token response."
 * @see https://developer.va.gov/explore/api/patient-health/authorization-code
 */
export type VATokenSet = CoreTokenSet &
  WithPatientId & {
    refreshToken?: string;
    idToken?: string;
    scope?: string;
  };

export interface VAClient {
  initiateAuth: (
    config: OAuthConfig,
  ) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<VATokenSet>;
  refresh: (tokens: VATokenSet, config: OAuthConfig) => Promise<VATokenSet>;
  isExpired: (tokens: VATokenSet, bufferSeconds?: number) => boolean;
}

/**
 * Creates an OAuth client for VA (Veterans Affairs) Patient Health API.
 * Handles the SMART on FHIR flow with PKCE and standard refresh_token grant.
 * Requires the launch/patient scope to receive the patient identifier.
 * @see https://developer.va.gov/explore/api/patient-health/authorization-code
 */
export function createVAClient(): VAClient {
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
      if (!tokens.refreshToken) {
        throw new Error('No refresh token available');
      }

      if (!config.tenant?.tokenUrl) {
        throw OAuthErrors.noTokenUrl();
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: config.clientId,
      });

      if (tokens.scope) {
        body.set('scope', tokens.scope);
      } else if (config.scopes?.length) {
        body.set('scope', config.scopes.join(' '));
      }

      const res = await fetch(config.tenant.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      const newTokens = await parseTokenResponse(res);

      return {
        ...newTokens,
        idToken: newTokens.idToken ?? tokens.idToken,
        patientId: tokens.patientId,
      };
    },

    isExpired: isTokenExpired,
  };
}
