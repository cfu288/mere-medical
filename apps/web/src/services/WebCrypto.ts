type Signature = ArrayBuffer;
type Data = ArrayBuffer;

// Configuration for IndexedDb for local key store
export const IDBKeyConfig = {
  DATABASE_NAME: 'KeyDb',
  OBJECT_STORE_NAME: 'KeyObjectStore',
  VERSION: 1,
  KEY_ID: 1,
};

interface CryptoConfig {
  name: string;
  modulusLength: 1024 | 2048 | 4096;
  publicExponent: Uint8Array;
  hash: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
  extractable: false;
  keyUsages: KeyUsage[];
}

// Configuration for WebCrypto
export const CryptoConfig: CryptoConfig = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: 'SHA-384',
  extractable: false,
  keyUsages: ['sign', 'verify'],
};

/**
 * Returns a new non-exportable key pair for signing and verifying.
 * @returns {Promise<CryptoKeyPair>}
 */
function makeKeys(): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey(
    {
      name: CryptoConfig.name,
      modulusLength: CryptoConfig.modulusLength,
      publicExponent: CryptoConfig.publicExponent,
      hash: CryptoConfig.hash,
    },
    CryptoConfig.extractable, //whether the key is extractable (i.e. can be used in exportKey)
    CryptoConfig.keyUsages
  );
}

/**
 * Takes a payload and signs it with a key pair. Returns the signature only, not the payload.
 * @param data Data to sign
 * @param keys Key pair to sign with
 * @returns signature
 */
function sign(data: Data, key: CryptoKey): Promise<Signature> {
  return window.crypto.subtle.sign(
    {
      name: CryptoConfig.name,
      hash: CryptoConfig.hash,
    },
    key, //from generateKey or importKey above
    data //ArrayBuffer of data you want to sign
  );
}

/**
 * Given data, a key pair, and a signature, verifies that the signature is valid for the data.
 * @param data Payload to verify
 * @param keys Public key to verify with
 * @param signature Signature to verify
 * @returns true if data was signed with signature is valid, false otherwise
 */
function verify(
  data: Data,
  key: CryptoKey,
  signature: Signature
): Promise<boolean> {
  return window.crypto.subtle.verify(
    {
      name: CryptoConfig.name,
      hash: CryptoConfig.hash, //the length of the salt
    },
    key, //from generateKey or importKey above
    signature, //ArrayBuffer of the signature
    data //ArrayBuffer of the data
  );
}

/**
 * Opens indexedDb and handles initial setup
 * @returns
 */
function openDb() {
  const indexedDB = window.indexedDB;
  // Open (or create) the database
  const open = indexedDB.open(IDBKeyConfig.DATABASE_NAME, IDBKeyConfig.VERSION);

  // Create the schema
  open.onupgradeneeded = function () {
    const db = open.result;
    db.createObjectStore(IDBKeyConfig.OBJECT_STORE_NAME, {
      keyPath: 'id',
    });
  };

  return open;
}

/**
 * Gets the public key from the local key store. If the key does not exist, creates a new key pair
 * @returns Public key as JsonWebKey
 */
export async function getPublicKey(): Promise<JsonWebKey> {
  return new Promise((resolve, reject) => {
    // Open (or create) the database
    const open = openDb();

    open.onsuccess = function () {
      // Start a new transaction
      const db = open.result;
      const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);

      const getKeys = store.get(IDBKeyConfig.KEY_ID) as IDBRequest<{
        id: number;
        keys: CryptoKeyPair;
      }>;
      getKeys.onsuccess = async function () {
        try {
          const keys = await getKeysFromDbOrCreate(getKeys, db);
          const publicKey = await window.crypto.subtle.exportKey(
            'jwk',
            keys.publicKey
          );
          resolve(publicKey);
        } catch (e) {
          reject(e);
        }
      };
    };
  });
}

/**
 * Signs a payload with a key pair that is stored in browser indexedDb.
 * If key pair does not exist, creates a new key pair using WebCrypto
 * and stores the keys in indexedDb.
 * @param data payload to sign
 * @returns Signature as ArrayBuffer
 */
export async function signPayload(data: Data): Promise<Signature> {
  return new Promise((resolve, reject) => {
    // Open (or create) the database
    const open = openDb();

    open.onsuccess = function () {
      // Start a new transaction
      const db = open.result;
      const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);

      const getKeys = store.get(IDBKeyConfig.KEY_ID) as IDBRequest<{
        id: number;
        keys: CryptoKeyPair;
      }>;
      getKeys.onsuccess = async function () {
        try {
          const keys = await getKeysFromDbOrCreate(getKeys, db);
          const signature = await sign(data, keys.privateKey);
          resolve(signature);
        } catch (e) {
          reject(e);
        }
      };
      getKeys.onerror = async function () {
        reject(getKeys.error);
      };
    };
  });
}

// function to get keys or create them if they don't exist
async function getKeysFromDbOrCreate(
  keyRequest: IDBRequest<{
    id: number;
    keys: CryptoKeyPair;
  }>,
  db: IDBDatabase
): Promise<CryptoKeyPair> {
  let keys = keyRequest.result?.keys;
  if (!keys) {
    // Keys do not exist, create new keys
    keys = await makeKeys();
    if (makeKeys() === undefined) {
      throw new Error(
        'Could not create keys - Your browser does not support WebCrypto or you are running without SSL enabled.'
      );
    }
    // Create new transaction to store new keys, as the previous one is closed
    const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readwrite');
    const newTxStore = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);
    newTxStore.put({ id: 1, keys });
  }
  return keys;
}

/**
 * Verifies that a payload was signed with signature using a key pair that is stored in browser indexedDb.
 * @param data payload to verify
 * @param signature	signature used to sign payload
 * @returns true if data was signed with signature is valid, false otherwise
 */
export function verifyPayload(
  data: Data,
  signature: Signature
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Open (or create) the database
    const open = openDb();

    open.onsuccess = function () {
      // Start a new transaction
      const db = open.result;
      const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);

      const getKeys = store.get(IDBKeyConfig.KEY_ID) as IDBRequest<{
        id: number;
        keys: CryptoKeyPair;
      }>;
      getKeys.onsuccess = async function () {
        const key = getKeys.result.keys.publicKey;
        const isValid = await verify(data, key, signature);
        resolve(isValid);
      };
      getKeys.onerror = async function () {
        reject(getKeys.error);
      };
    };
  });
}

// Helpers

/**
 * Convert a normal string to a base64Url string - removes chars that are not allowed in a url
 * @param data
 * @returns
 */
export function stringToBase64UrlString(data: string): string {
  return base64StringtoBase64UrlString(btoa(data));
}

/**
 * Converts a string in base64 to base64url format
 * @param base64String base64 string
 * @returns base64Url string
 */
export function base64StringtoBase64UrlString(base64: string): string {
  let base64Formatted = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s/g, '');

  // Pad out with standard base64 required padding characters
  const pad = base64Formatted.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error(
        'InvalidLengthError: Input base64 string is the wrong length to determine padding'
      );
    }
    base64Formatted += new Array(5 - pad).join('=');
  }
  return base64Formatted;
}

/**
 * Converts an ArrayBuffer to a base64 string
 * @param arrayBuffer ArrayBuffer to convert
 * @returns base64 string
 */
export function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(arrayBuffer);
  let byteString = '';

  byteArray.forEach((byte) => {
    byteString += String.fromCharCode(byte);
  });

  return btoa(byteString)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Converts a string in base64url format to an ArrayBuffer
 * @param base64String base64 string
 * @returns ArrayBuffer
 */
export function base64UrlStringToArrayBuffer(
  base64UrlString: string
): ArrayBuffer {
  const binaryString = atob(base64UrlString),
    bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Converts a string to base64 and returns an ArrayBuffer representation. Important because we need a binary representation of the string to sign it.
 * @param str string
 * @returns ArrayBuffer of base64 string
 */
export function stringToBase64UrlArrayBuffer(str: string): ArrayBuffer {
  return base64UrlStringToArrayBuffer(base64StringtoBase64UrlString(btoa(str)));
}
