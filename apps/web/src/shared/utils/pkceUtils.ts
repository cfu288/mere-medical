/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 flows.
 * Used by integrations that require PKCE like VA and Healow.
 */

function dec2hex(dec: number): string {
  return ('0' + dec.toString(16)).slice(-2);
}

function generateCodeVerifier(): string {
  const array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer: ArrayBuffer): string {
  let str = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallengeFromVerifier(
  verifier: string,
): Promise<string> {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

export function getCodeVerifier(storageKey: string): string {
  const codeVerifier = sessionStorage.getItem(storageKey);
  if (codeVerifier) {
    return codeVerifier;
  }
  const generatedCodeVerifier = generateCodeVerifier();
  sessionStorage.setItem(storageKey, generatedCodeVerifier);
  return generatedCodeVerifier;
}

export async function getCodeChallenge(storageKey: string): Promise<string> {
  const codeVerifier = getCodeVerifier(storageKey);
  return generateCodeChallengeFromVerifier(codeVerifier);
}

export function getOAuthState(storageKey: string): string {
  const state = sessionStorage.getItem(storageKey);
  if (state) {
    return state;
  }
  const randBytes = window.crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(randBytes, (byte) => byte.toString(16)).join('');
  sessionStorage.setItem(storageKey, hex);
  return hex;
}

export function clearPkceSession(verifierKey: string, stateKey?: string): void {
  sessionStorage.removeItem(verifierKey);
  if (stateKey) {
    sessionStorage.removeItem(stateKey);
  }
}
