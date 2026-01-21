import type { AuthSession, TenantConfig } from './types.js';

export interface SessionOptions {
  usePkce: boolean;
  useState: boolean;
  tenant?: TenantConfig;
}

export const createSession = async (options: SessionOptions): Promise<AuthSession> => {
  return {
    codeVerifier: options.usePkce ? generateCodeVerifier() : undefined,
    state: options.useState ? crypto.randomUUID() : undefined,
    tenant: options.tenant,
    startedAt: Date.now(),
  };
};

export const generateCodeVerifier = (): string => {
  const array = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(array);
};

export const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
};

const base64UrlEncode = (data: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
