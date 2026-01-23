import type { CoreTokenSet } from '../types.js';

export const ONPATIENT_CONSTANTS = {
  BASE_URL: 'https://onpatient.com',
  FHIR_URL: 'https://onpatient.com/api/fhir',
  AUTH_URL: 'https://onpatient.com/o/authorize/',
  DEFAULT_SCOPE: 'patient/*.read',
} as const;

export interface OnPatientTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  patient?: string;
  token_type?: string;
}

/**
 * OnPatient token responses include access_token, refresh_token, scope, and
 * expires_in (always 48 hours). Per OnPatient docs, patient ID is not included
 * in the token response - it must be obtained separately via the FHIR API.
 * @see https://www.onpatient.com/api_fhir/api-docs/documentation/
 */
export type OnPatientTokenSet = CoreTokenSet & {
  refreshToken?: string;
  scope?: string;
};

export function parseOnPatientTokenResponse(data: OnPatientTokenResponse): OnPatientTokenSet {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    accessToken: data.access_token,
    expiresAt: nowSeconds + data.expires_in,
    refreshToken: data.refresh_token,
    scope: data.scope,
    raw: data as unknown as Record<string, unknown>,
  };
}
