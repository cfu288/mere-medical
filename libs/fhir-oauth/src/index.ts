// Types
export type {
  TenantConfig,
  OAuthConfig,
  AuthSession,
  TokenSet,
} from './lib/types.js';
export { OAuthError, createOAuthError } from './lib/types.js';

// Session management
export type { SessionOptions } from './lib/session.js';
export {
  createSession,
  generateCodeVerifier,
  generateCodeChallenge,
} from './lib/session.js';

// Auth URL builders
export type { AuthUrlBuilder } from './lib/auth-url.js';
export { buildStandardAuthUrl, buildFixedEndpointAuthUrl } from './lib/auth-url.js';

// Token exchange
export type { TokenExchanger } from './lib/token-exchange.js';
export {
  exchangeWithPkce,
  exchangeNoPkce,
  exchangeViaProxy,
  exchangeAtFixedEndpoint,
  parseTokenResponse,
} from './lib/token-exchange.js';

// Token refresh
export type { TokenRefresher, JwtSigner, JwtPayload, JwtBearerRefreshOptions } from './lib/token-refresh.js';
export {
  noRefresh,
  standardRefresh,
  standardRefreshAtFixedEndpoint,
  jwtBearerRefresh,
  conditionalRefresh,
} from './lib/token-refresh.js';

// Patient ID extraction
export type { PatientIdExtractor } from './lib/patient-id.js';
export {
  patientIdFromResponse,
  patientIdFromIdToken,
  patientIdFromAccessToken,
  noPatientId,
  decodeJwt,
} from './lib/patient-id.js';

// OAuth client factory
export type { OAuthClientSpec, OAuthClient } from './lib/client.js';
export { createOAuthClient } from './lib/client.js';

// Vendor clients
export {
  createEpicClient,
  createEpicClientWithProxy,
  registerEpicDynamicClient,
  type EpicClientDependencies,
  type PublicKeyWithKid,
  type DynamicClientRegistrationOptions,
} from './lib/vendors/epic.js';
