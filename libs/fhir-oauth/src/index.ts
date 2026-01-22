// Vendor clients - primary API
export {
  createEpicClient,
  createEpicClientWithProxy,
  registerEpicDynamicClient,
} from './lib/vendors/epic.js';

export { createCernerClient } from './lib/vendors/cerner.js';

export {
  parseOnPatientTokenResponse,
  ONPATIENT_CONSTANTS,
  type OnPatientTokenResponse,
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
  buildOnPatientAuthUrl,
  EPIC_DEFAULT_SCOPES,
  CERNER_DEFAULT_SCOPES,
  type OAuthConfigOptions,
  type OnPatientConfigOptions,
} from './lib/config-builders.js';

// Shared utilities - use when implementing custom clients
export { validateCallback, isTokenExpired } from './lib/token-exchange.js';
export { initiateStandardAuth } from './lib/auth-url.js';

// Core types
export type {
  OAuthClient,
  OAuthConfig,
  TenantConfig,
  TokenSet,
  AuthorizationRequestState,
} from './lib/types.js';
export { OAuthError, OAuthErrors } from './lib/types.js';
