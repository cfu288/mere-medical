import type { AuthorizationRequestState, TenantConfig } from './types.js';

export interface SessionOptions {
  usePkce: boolean;
  useState: boolean;
  tenant?: TenantConfig;
}

/**
 * Generates the client-side state required before redirecting to an OAuth
 * authorization server. The code verifier enables PKCE (preventing authorization
 * code interception), and the state parameter prevents CSRF attacks. Persist
 * this state before redirecting, then restore it to validate the callback.
 *
 * @example
 * const tenant = { id: 'epic_123', authUrl: '...', tokenUrl: '...', ... };
 * const config = { clientId: 'my-app', redirectUri: '/callback', scopes: ['openid'], tenant };
 *
 * // 1. Before redirecting to the authorization server:
 * const authState = await generateAuthorizationRequestState({ usePkce: true, useState: true, tenant });
 * sessionStorage.setItem('code_verifier', authState.codeVerifier);
 * sessionStorage.setItem('oauth_state', authState.state);
 * window.location.href = await buildStandardAuthUrl(config, authState);
 *
 * // 2. After user is redirected back with ?code=...&state=...:
 * const authState = {
 *   codeVerifier: sessionStorage.getItem('code_verifier'),
 *   state: sessionStorage.getItem('oauth_state'),
 *   startedAt: 0,
 * };
 * const tokens = await exchangeWithPkce(code, config, authState);
 */
export async function generateAuthorizationRequestState(
  options: SessionOptions,
): Promise<AuthorizationRequestState> {
  return {
    codeVerifier: options.usePkce ? generateCodeVerifier() : undefined,
    state: options.useState ? crypto.randomUUID() : undefined,
    tenant: options.tenant,
    startedAt: Date.now(),
  };
}

/**
 * Generates a cryptographically random code verifier for PKCE. Returns a
 * 43-character base64url string derived from 32 random bytes.
 */
export function generateCodeVerifier(): string {
  const array = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(array);
}

/**
 * Computes the S256 code challenge from a code verifier by taking the SHA-256
 * hash and base64url encoding it.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
