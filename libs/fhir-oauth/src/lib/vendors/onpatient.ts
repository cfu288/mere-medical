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

export type OnPatientTokenSet = CoreTokenSet & {
  refreshToken?: string;
  patientId?: string;
};

export function parseOnPatientTokenResponse(data: OnPatientTokenResponse): OnPatientTokenSet {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    accessToken: data.access_token,
    expiresAt: nowSeconds + data.expires_in,
    refreshToken: data.refresh_token,
    patientId: data.patient,
    raw: data as unknown as Record<string, unknown>,
  };
}
