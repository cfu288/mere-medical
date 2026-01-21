/**
 * @mere/fhir-oauth - OAuth clients for FHIR servers
 *
 * @example
 * import { createEpicClient } from '@mere/fhir-oauth';
 *
 * // On login page - initiate auth and redirect
 * const client = createEpicClient({ signJwt });
 * const { url, session } = await client.initiateAuth(config);
 * sessionStorage.setItem('oauth_session', JSON.stringify(session));
 * window.location.href = url;
 *
 * // On callback page - restore session and exchange code for tokens
 * const client = createEpicClient({ signJwt });
 * const session = JSON.parse(sessionStorage.getItem('oauth_session'));
 * const tokens = await client.handleCallback(searchParams, config, session);
 */

// Vendor clients - primary API
export {
  createEpicClient,
  createEpicClientWithProxy,
  registerEpicDynamicClient,
} from './lib/vendors/epic.js';

export { createCernerClient } from './lib/vendors/cerner.js';

// Core types
export type {
  OAuthClient,
  OAuthConfig,
  TenantConfig,
  TokenSet,
  AuthorizationRequestState,
} from './lib/types.js';
export { OAuthError } from './lib/types.js';
