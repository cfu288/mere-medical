// Vendor clients - primary API
export {
  createEpicClient,
  createEpicClientWithProxy,
  registerEpicDynamicClient,
  type EpicClient,
  type EpicTokenSet,
} from './lib/vendors/epic.js';

export {
  createCernerClient,
  type CernerClient,
  type CernerTokenSet,
} from './lib/vendors/cerner.js';

export {
  createVAClient,
  type VAClient,
  type VATokenSet,
} from './lib/vendors/va.js';

export {
  parseOnPatientTokenResponse,
  ONPATIENT_CONSTANTS,
  type OnPatientTokenResponse,
  type OnPatientTokenSet,
} from './lib/vendors/onpatient.js';

// Session management
export {
  createSessionManager,
  type SessionManager,
} from './lib/session-manager.js';

// Config builders - validated OAuthConfig construction
export {
  buildEpicOAuthConfig,
  buildCernerOAuthConfig,
  buildVAOAuthConfig,
  buildOnPatientAuthUrl,
  EPIC_DEFAULT_SCOPES,
  CERNER_DEFAULT_SCOPES,
  VA_DEFAULT_SCOPES,
  VA_SANDBOX_TENANT,
  type OAuthConfigOptions,
  type OnPatientConfigOptions,
  type VAOAuthConfigOptions,
} from './lib/config-builders.js';

// Shared utilities - use when implementing custom clients
export { validateCallback, isTokenExpired } from './lib/token-exchange.js';
export { initiateStandardAuth } from './lib/auth-url.js';

// Core types
export type {
  OAuthClient,
  OAuthConfig,
  TenantConfig,
  CoreTokenSet,
  ParsedTokenResponse,
  WithRefreshToken,
  WithIdToken,
  WithScope,
  WithPatientId,
  WithClientId,
  AuthorizationRequestState,
} from './lib/types.js';
export { OAuthError, OAuthErrors } from './lib/types.js';
