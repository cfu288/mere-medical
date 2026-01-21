import type { AuthSession } from '@mere/fhir-oauth';

export type OAuthVendor =
  | 'epic'
  | 'cerner'
  | 'veradigm'
  | 'onpatient'
  | 'va'
  | 'healow';

const STORAGE_KEYS = {
  epic: { verifier: 'EPIC_CODE_VERIFIER', state: 'EPIC_OAUTH_STATE' },
  cerner: { verifier: 'CERNER_CODE_VERIFIER', state: 'CERNER_OAUTH_STATE' },
  veradigm: {
    verifier: 'VERADIGM_CODE_VERIFIER',
    state: 'VERADIGM_OAUTH_STATE',
  },
  onpatient: {
    verifier: 'ONPATIENT_CODE_VERIFIER',
    state: 'ONPATIENT_OAUTH_STATE',
  },
  va: { verifier: 'VA_CODE_VERIFIER', state: 'VA_OAUTH_STATE' },
  healow: { verifier: 'HEALOW_CODE_VERIFIER', state: 'HEALOW_OAUTH_STATE' },
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
