export type {
  TenantConfig,
  OAuthConfig,
  AuthorizationRequestState,
  TokenSet,
  OAuthClient,
} from './lib/types.js';
export { OAuthError, createOAuthError } from './lib/types.js';

export type { SessionOptions } from './lib/session.js';
export {
  generateAuthorizationRequestState,
  generateCodeVerifier,
  generateCodeChallenge,
} from './lib/session.js';

export { buildStandardAuthUrl } from './lib/auth-url.js';

export { exchangeWithPkce, parseTokenResponse } from './lib/token-exchange.js';

export {
  createEpicClient,
  createEpicClientWithProxy,
  registerEpicDynamicClient,
  type EpicClient,
  type EpicClientDependencies,
  type JwtSigner,
  type PublicKeyWithKid,
  type DynamicClientRegistrationOptions,
} from './lib/vendors/epic.js';
