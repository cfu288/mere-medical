/**
 * React hooks for @mere/fhir-oauth
 *
 * @example
 * import { createEpicClient } from '@mere/fhir-oauth';
 * import { useOAuthFlow } from '@mere/fhir-oauth/react';
 *
 * type Vendor = 'epic' | 'cerner';
 * const client = createEpicClient({ signJwt });
 *
 * const { initiateAuth, handleCallback } = useOAuthFlow<Vendor>({
 *   client,
 *   vendor: 'epic',
 * });
 */

export { useOAuthFlow, type UseOAuthFlowOptions } from './lib/hooks/useOAuthFlow.js';
export {
  useOAuthorizationRequestState,
  type UseOAuthorizationRequestStateOptions,
} from './lib/hooks/useOAuthorizationRequestState.js';
export { type StorageAdapter } from './lib/types.js';
