import { validateCallback, isTokenExpired } from './token-exchange';
import { OAuthError } from './types';
import type { AuthorizationRequestState, TokenSet } from './types';

describe('validateCallback', () => {
  const validSession: AuthorizationRequestState = {
    codeVerifier: 'test-verifier',
    state: 'test-state-123',
    startedAt: Date.now(),
  };

  it('returns the authorization code when params are valid', () => {
    const params = new URLSearchParams({
      code: 'auth-code-abc',
      state: 'test-state-123',
    });

    const result = validateCallback(params, validSession);
    expect(result).toBe('auth-code-abc');
  });

  it('throws OAuthError with server error code when error param is present', () => {
    const params = new URLSearchParams({
      error: 'access_denied',
      error_description: 'User denied access',
    });

    expect(() => validateCallback(params, validSession)).toThrow(OAuthError);
    try {
      validateCallback(params, validSession);
    } catch (e) {
      expect(e).toBeInstanceOf(OAuthError);
      expect((e as OAuthError).code).toBe('access_denied');
      expect((e as OAuthError).message).toBe('User denied access');
    }
  });

  it('throws OAuthError with generic message when error_description is missing', () => {
    const params = new URLSearchParams({
      error: 'server_error',
    });

    try {
      validateCallback(params, validSession);
    } catch (e) {
      expect((e as OAuthError).code).toBe('server_error');
      expect((e as OAuthError).message).toBe('OAuth error');
    }
  });

  it('throws state_mismatch when state does not match session', () => {
    const params = new URLSearchParams({
      code: 'auth-code-abc',
      state: 'wrong-state',
    });

    expect(() => validateCallback(params, validSession)).toThrow(OAuthError);
    try {
      validateCallback(params, validSession);
    } catch (e) {
      expect((e as OAuthError).code).toBe('state_mismatch');
    }
  });

  it('throws state_mismatch when state is missing from params', () => {
    const params = new URLSearchParams({
      code: 'auth-code-abc',
    });

    try {
      validateCallback(params, validSession);
    } catch (e) {
      expect((e as OAuthError).code).toBe('state_mismatch');
    }
  });

  it('throws state_mismatch when session state is undefined', () => {
    const sessionWithoutState: AuthorizationRequestState = {
      codeVerifier: 'test-verifier',
      startedAt: Date.now(),
    };
    const params = new URLSearchParams({
      code: 'auth-code-abc',
      state: 'some-state',
    });

    try {
      validateCallback(params, sessionWithoutState);
    } catch (e) {
      expect((e as OAuthError).code).toBe('state_mismatch');
    }
  });

  it('throws missing_code when code param is absent', () => {
    const params = new URLSearchParams({
      state: 'test-state-123',
    });

    expect(() => validateCallback(params, validSession)).toThrow(OAuthError);
    try {
      validateCallback(params, validSession);
    } catch (e) {
      expect((e as OAuthError).code).toBe('missing_code');
    }
  });

  it('prioritizes error param over other validations', () => {
    const params = new URLSearchParams({
      error: 'invalid_request',
      state: 'wrong-state',
    });

    try {
      validateCallback(params, validSession);
    } catch (e) {
      expect((e as OAuthError).code).toBe('invalid_request');
    }
  });
});

describe('isTokenExpired', () => {
  const createTokenSet = (expiresAt: number): TokenSet => ({
    accessToken: 'test-token',
    expiresAt,
    raw: {},
  });

  it('returns false when token is not expired', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const tokens = createTokenSet(futureTime);

    expect(isTokenExpired(tokens)).toBe(false);
  });

  it('returns true when token is expired', () => {
    const pastTime = Math.floor(Date.now() / 1000) - 100;
    const tokens = createTokenSet(pastTime);

    expect(isTokenExpired(tokens)).toBe(true);
  });

  it('returns true when token expires within default buffer (60s)', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokens = createTokenSet(nowSeconds + 30);

    expect(isTokenExpired(tokens)).toBe(true);
  });

  it('returns false when token expires outside default buffer', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokens = createTokenSet(nowSeconds + 120);

    expect(isTokenExpired(tokens)).toBe(false);
  });

  it('uses custom buffer when provided', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokens = createTokenSet(nowSeconds + 200);

    expect(isTokenExpired(tokens, 300)).toBe(true);
    expect(isTokenExpired(tokens, 100)).toBe(false);
  });

  it('returns true when token expires exactly at buffer boundary', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokens = createTokenSet(nowSeconds + 60);

    expect(isTokenExpired(tokens, 60)).toBe(true);
  });
});
