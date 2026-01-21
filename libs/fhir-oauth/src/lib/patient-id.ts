import type { TokenSet } from './types.js';
import { createOAuthError } from './types.js';

export type PatientIdExtractor = (tokens: TokenSet) => string;

export const patientIdFromResponse =
  (field = 'patient'): PatientIdExtractor =>
  (tokens) => {
    const id = tokens.raw[field] as string | undefined;
    if (!id) {
      throw createOAuthError(
        'missing_patient',
        `No ${field} field in token response`
      );
    }
    return id;
  };

export const patientIdFromIdToken =
  (claim = 'fhirUser'): PatientIdExtractor =>
  (tokens) => {
    if (!tokens.idToken) {
      throw createOAuthError('missing_id_token', 'No id_token in response');
    }

    const payload = decodeJwt(tokens.idToken);
    const fhirUser = payload[claim] as string | undefined;

    if (!fhirUser) {
      throw createOAuthError('missing_claim', `No ${claim} claim in id_token`);
    }

    return fhirUser.split('/').pop()!;
  };

export const patientIdFromAccessToken =
  (claim: string): PatientIdExtractor =>
  (tokens) => {
    const payload = decodeJwt(tokens.accessToken);
    const id = payload[claim] as string | undefined;

    if (!id) {
      throw createOAuthError(
        'missing_claim',
        `No ${claim} claim in access_token`
      );
    }

    return id;
  };

export const noPatientId: PatientIdExtractor = () => '';

export const decodeJwt = (token: string): Record<string, unknown> => {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
};
