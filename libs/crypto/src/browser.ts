export type {
  PublicKeyWithKid,
  JsonWebKeySet,
  JwtPayload,
  JwtSigner,
  KeyStorage,
} from './lib/types';

export { type JwtConfig, createJwtSigner, createJwtVerifier } from './lib/jwt';

export {
  getPublicKey,
  signPayload,
  verifyPayload,
  indexedDBKeyStorage,
  IDBKeyConfig,
} from './lib/browser/key-storage';

export {
  base64StringToBase64UrlString,
  base64StringToArrayBuffer,
  base64UrlStringToBase64String,
  base64UrlStringToArrayBuffer,
  arrayBufferToBase64String,
  arrayBufferToBase64UrlString,
  textStringToBase64String,
  textStringToBase64UrlString,
  textStringToBase64UrlArrayBuffer,
  textStringToBase64ArrayBuffer,
} from './lib/base64';

import { createJwtSigner, createJwtVerifier } from './lib/jwt';
import { signPayload, verifyPayload, IDBKeyConfig } from './lib/browser/key-storage';

export const signJwt = createJwtSigner({
  keyId: IDBKeyConfig.KEY_ID,
  signPayload,
  verifyPayload,
});

export const verifyJwt = createJwtVerifier({
  keyId: IDBKeyConfig.KEY_ID,
  signPayload,
  verifyPayload,
});
