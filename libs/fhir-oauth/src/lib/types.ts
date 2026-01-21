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

export interface AuthSession {
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

export const createOAuthError = (
  code: string,
  message: string,
  cause?: unknown
): OAuthError => new OAuthError(code, message, cause);
