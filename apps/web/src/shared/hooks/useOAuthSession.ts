import type { AuthSession } from '@mere/fhir-oauth';

export type OAuthVendor =
  | 'epic'
  | 'cerner'
  | 'veradigm'
  | 'onpatient'
  | 'va'
  | 'healow';

const STORAGE_KEYS = {
  epic: { verifier: 'epic_code_verifier', state: 'epic_oauth_state' },
  cerner: { verifier: 'cerner_code_verifier', state: 'cerner_oauth_state' },
  veradigm: {
    verifier: 'veradigm_code_verifier',
    state: 'veradigm_oauth_state',
  },
  onpatient: {
    verifier: 'onpatient_code_verifier',
    state: 'onpatient_oauth_state',
  },
  va: { verifier: 'va_code_verifier', state: 'va_oauth2_state' },
  healow: { verifier: 'healow_code_verifier', state: 'healow_oauth2_state' },
} as const satisfies Record<OAuthVendor, { verifier: string; state: string }>;

export const useOAuthSession = <V extends OAuthVendor>(vendor: V) => {
  const keys = STORAGE_KEYS[vendor];

  const saveSession = (session: AuthSession) => {
    if (session.codeVerifier) {
      sessionStorage.setItem(keys.verifier, session.codeVerifier);
    }
    if (session.state) {
      sessionStorage.setItem(keys.state, session.state);
    }
  };

  const loadSession = (): AuthSession | null => {
    const verifier = sessionStorage.getItem(keys.verifier);
    const state = sessionStorage.getItem(keys.state);
    if (!verifier && !state) return null;
    return {
      codeVerifier: verifier ?? undefined,
      state: state ?? undefined,
      startedAt: 0,
    };
  };

  const clearSession = () => {
    sessionStorage.removeItem(keys.verifier);
    sessionStorage.removeItem(keys.state);
  };

  return { saveSession, loadSession, clearSession, keys };
};
