import {
  IDBKeyConfig,
  textStringToBase64UrlString,
  textStringToBase64UrlArrayBuffer,
  signPayload,
  arrayBufferToBase64String,
  verifyPayload,
  base64StringToBase64UrlString,
  base64UrlStringToArrayBuffer,
} from './WebCrypto';

export interface JsonWebKeyWKid extends JsonWebKey {
  kid: string;
  kty: string;
  e: string;
  n: string;
}

export interface JsonWebKeySet {
  keys: JsonWebKeyWKid[];
}

type TokenPayload = Record<string, string | number | boolean | object>;

/**
 * Takes a JSON payload, signs it, and returns a signed JWT in format {header}.{body}.{signature}
 * @param tokenPayload JWT payload to sign
 * @returns An object with the signed JWT
 */
export async function signJwt(tokenPayload: TokenPayload): Promise<string> {
  const header = {
    alg: 'RS384',
    typ: 'JWT',
    kid: IDBKeyConfig.KEY_ID,
  };

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const futureTimeExpiry = 300;

  const payload: TokenPayload = {
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

  const messageAsArrayBuffer =
    textStringToBase64UrlArrayBuffer(headerAndPayload);

  const signature = await signPayload(messageAsArrayBuffer);
  const base64Signature = base64StringToBase64UrlString(
    arrayBufferToBase64String(signature),
  );

  return `${headerAndPayload}.${base64Signature}`;
}

export async function verifyJwt(jwt: string) {
  const [header, payload, signature] = jwt.split('.');
  const headerAndPayloadAsUint8Array = textStringToBase64UrlArrayBuffer(
    `${header}.${payload}`,
  );
  const signatureAsUint8Array = base64UrlStringToArrayBuffer(
    base64StringToBase64UrlString(signature),
  );

  return await verifyPayload(
    headerAndPayloadAsUint8Array,
    signatureAsUint8Array,
  );
}
