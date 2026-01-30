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

export {
  createVeradigmClient,
  buildVeradigmOAuthConfig,
  VERADIGM_DEFAULT_SCOPES,
  type VeradigmClient,
  type VeradigmTokenSet,
  type VeradigmOAuthConfigOptions,
} from './lib/vendors/veradigm.js';

export {
  createHealowClient,
  createHealowClientWithProxy,
  createHealowClientConfidential,
  buildHealowOAuthConfig,
  extractPatientIdFromIdToken as extractHealowPatientId,
  HEALOW_DEFAULT_SCOPES,
  type HealowClient,
  type HealowApiEndpoints,
  type HealowProxyUrlBuilder,
  type HealowTokenSet,
  type HealowOAuthConfigOptions,
} from './lib/vendors/healow.js';

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
export { parseJwtPayload } from './lib/jwt.js';
export { extractRelativeFhirPath } from './lib/url-utils.js';

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
