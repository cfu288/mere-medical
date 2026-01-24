export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface TenantConfig {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  fhirBaseUrl: string;
  fhirVersion?: 'DSTU2' | 'R4';
}

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  tenant?: TenantConfig;
}

export interface AuthorizationRequestState {
  codeVerifier?: string;
  state?: string;
  tenant?: TenantConfig;
  startedAt: number;
}

export interface CoreTokenSet {
  accessToken: string;
  expiresAt: number;
  raw: Record<string, unknown>;
}

export interface WithRefreshToken {
  refreshToken: string;
}

export interface WithIdToken {
  idToken: string;
}

export interface WithScope {
  scope: string;
}

export interface WithPatientId {
  patientId: string;
}

export interface WithClientId {
  clientId: string;
}

export type ParsedTokenResponse = CoreTokenSet & {
  refreshToken?: string;
  idToken?: string;
  scope?: string;
};

export interface OAuthClient<T extends CoreTokenSet = CoreTokenSet> {
  initiateAuth: (config: OAuthConfig) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<T>;
  refresh: (tokens: T, config: OAuthConfig) => Promise<T>;
  isExpired: (tokens: T, bufferSeconds?: number) => boolean;
}

export class OAuthError extends Error {
  public code: string;
  public cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    this.cause = cause;
  }
}

export function createOAuthError(
  code: string,
  message: string,
  cause?: unknown,
): OAuthError {
  return new OAuthError(code, message, cause);
}

export const OAuthErrors = {
  noTokenUrl: () => new OAuthError('no_token_url', 'No token URL provided'),
  stateMismatch: () => new OAuthError('state_mismatch', 'OAuth state validation failed'),
  missingCode: () => new OAuthError('missing_code', 'No authorization code in callback'),
  missingCodeVerifier: () => new OAuthError('missing_code_verifier', 'PKCE code verifier not found in session'),
  missingAccessToken: () => new OAuthError('missing_access_token', 'No access_token in token response'),
  tokenExchangeFailed: (status: number, cause?: unknown) =>
    new OAuthError('token_exchange_failed', `Token exchange failed: ${status}`, cause),
} as const;
