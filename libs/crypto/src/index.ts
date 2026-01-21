/**
 * @mere/crypto - WebCrypto abstractions for browser-based cryptographic operations
 *
 * Provides key management and signing utilities that persist CryptoKeys in IndexedDB
 * across browser sessions. Keys are non-exportable for security.
 *
 * Primary use case: JWT signing for SMART on FHIR OAuth flows with dynamic client
 * registration, where the client needs a persistent key pair for token refresh.
 */

export type {
  PublicKeyWithKid,
  JsonWebKeySet,
  JwtPayload,
  JwtSigner,
  KeyStorage,
} from './lib/types';

export {
  signJwt,
  verifyJwt,
} from './lib/jwt';

export {
  getPublicKey,
  signPayload,
  verifyPayload,
  indexedDBKeyStorage,
  IDBKeyConfig,
} from './lib/key-storage';

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
