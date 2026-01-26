import type { JwtPayload } from './types';
import {
  textStringToBase64UrlString,
  textStringToBase64UrlArrayBuffer,
  arrayBufferToBase64String,
  base64StringToBase64UrlString,
  base64UrlStringToArrayBuffer,
} from './base64';

export interface JwtConfig {
  keyId: string | number;
  signPayload: (data: ArrayBuffer) => Promise<ArrayBuffer>;
  verifyPayload?: (data: ArrayBuffer, signature: ArrayBuffer) => Promise<boolean>;
}

export function createJwtSigner(config: JwtConfig) {
  return async function signJwt(tokenPayload: JwtPayload): Promise<string> {
    const header = {
      alg: 'RS384',
      typ: 'JWT',
      kid: String(config.keyId),
    };

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const futureTimeExpiry = 300;

    const payload: JwtPayload = {
      iat: nowInSeconds,
      nbf: nowInSeconds,
      exp: nowInSeconds + futureTimeExpiry,
      ...tokenPayload,
    };

    const stringifiedHeader = JSON.stringify(header);
    const stringifiedPayload = JSON.stringify(payload);

    const headerBase64 = textStringToBase64UrlString(stringifiedHeader);
    const payloadBase64 = textStringToBase64UrlString(stringifiedPayload);

    const headerAndPayload = `${headerBase64}.${payloadBase64}`;

    const messageAsArrayBuffer = textStringToBase64UrlArrayBuffer(headerAndPayload);

    const signature = await config.signPayload(messageAsArrayBuffer);
    const base64Signature = base64StringToBase64UrlString(
      arrayBufferToBase64String(signature)
    );

    return `${headerAndPayload}.${base64Signature}`;
  };
}

export function createJwtVerifier(config: JwtConfig) {
  if (!config.verifyPayload) {
    throw new Error('verifyPayload function is required for JWT verification');
  }

  const verifyPayload = config.verifyPayload;

  return async function verifyJwt(jwt: string): Promise<boolean> {
    const [header, payload, signature] = jwt.split('.');
    const headerAndPayloadAsUint8Array = textStringToBase64UrlArrayBuffer(
      `${header}.${payload}`
    );
    const signatureAsUint8Array = base64UrlStringToArrayBuffer(
      base64StringToBase64UrlString(signature)
    );

    return verifyPayload(headerAndPayloadAsUint8Array, signatureAsUint8Array);
  };
}
