export interface PublicKeyWithKid extends JsonWebKey {
  kid: string;
  kty: string;
  e: string;
  n: string;
}

export interface JsonWebKeySet {
  keys: PublicKeyWithKid[];
}

export type JwtPayload = Record<string, string | number | boolean | object>;

export type JwtSigner = (payload: JwtPayload) => Promise<string>;

export interface KeyStorage {
  getPrivateKey(): Promise<CryptoKey>;
  getPublicKey(): Promise<PublicKeyWithKid>;
  hasKeys(): Promise<boolean>;
  generateKeys(): Promise<CryptoKeyPair>;
}
