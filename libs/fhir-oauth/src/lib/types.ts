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

export interface TokenSet {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  idToken?: string;
  scope?: string;
  patientId?: string;
  clientId?: string;
  raw: Record<string, unknown>;
}

export interface OAuthClient {
  initiateAuth: (config: OAuthConfig) => Promise<{ url: string; session: AuthorizationRequestState }>;
  handleCallback: (
    params: URLSearchParams,
    config: OAuthConfig,
    session: AuthorizationRequestState,
  ) => Promise<TokenSet>;
  refresh: (tokens: TokenSet, config: OAuthConfig) => Promise<TokenSet>;
  isExpired: (tokens: TokenSet, bufferSeconds?: number) => boolean;
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
