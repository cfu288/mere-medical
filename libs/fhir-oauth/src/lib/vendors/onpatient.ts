import type { TokenSet } from '../types.js';

const ONPATIENT_BASE_URL = 'https://onpatient.com';
const ONPATIENT_AUTH_URL = `${ONPATIENT_BASE_URL}/o/authorize/`;
const ONPATIENT_FHIR_URL = `${ONPATIENT_BASE_URL}/api/fhir`;

export interface OnPatientTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  patient?: string;
  token_type?: string;
}

export interface OnPatientClient {
  buildAuthUrl: (config: { clientId: string; redirectUri: string }) => string;
  parseTokenResponse: (data: OnPatientTokenResponse) => TokenSet;
}

/**
 * Creates an OAuth client for OnPatient FHIR servers. OnPatient uses a confidential
 * client flow where token exchange happens on the backend (client_secret required).
 * This client provides helpers for building the auth URL and parsing token responses.
 */
export function createOnPatientClient(): OnPatientClient {
  return {
    buildAuthUrl({ clientId, redirectUri }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'patient/*.read',
        response_type: 'code',
      });
      return `${ONPATIENT_AUTH_URL}?${params}`;
    },

    parseTokenResponse(data) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      return {
        accessToken: data.access_token,
        expiresAt: nowSeconds + data.expires_in,
        refreshToken: data.refresh_token,
        scope: data.scope,
        patientId: data.patient,
        raw: data as unknown as Record<string, unknown>,
      };
    },
  };
}

export const ONPATIENT_CONSTANTS = {
  BASE_URL: ONPATIENT_BASE_URL,
  FHIR_URL: ONPATIENT_FHIR_URL,
  AUTH_URL: ONPATIENT_AUTH_URL,
} as const;
