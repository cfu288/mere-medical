import type { PublicKeyWithKid, KeyStorage } from './types';

export const IDBKeyConfig = {
  DATABASE_NAME: 'KeyDb',
  OBJECT_STORE_NAME: 'KeyObjectStore',
  VERSION: 1,
  KEY_ID: 1,
} as const;

const CryptoConfig = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: 'SHA-384',
  extractable: false,
  keyUsages: ['sign', 'verify'] as KeyUsage[],
} as const;

function makeKeys(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: CryptoConfig.name,
      modulusLength: CryptoConfig.modulusLength,
      publicExponent: CryptoConfig.publicExponent,
      hash: CryptoConfig.hash,
    },
    CryptoConfig.extractable,
    CryptoConfig.keyUsages
  );
}

function openDb(): IDBOpenDBRequest {
  const open = indexedDB.open(IDBKeyConfig.DATABASE_NAME, IDBKeyConfig.VERSION);

  open.onupgradeneeded = function () {
    const db = open.result;
    db.createObjectStore(IDBKeyConfig.OBJECT_STORE_NAME, { keyPath: 'id' });
  };

  return open;
}

async function getKeysFromDbOrCreate(
  keyRequest: IDBRequest<{ id: number; keys: CryptoKeyPair }>,
  db: IDBDatabase
): Promise<CryptoKeyPair> {
  let keys = keyRequest.result?.keys;
  if (!keys) {
    keys = await makeKeys();
    if (!keys) {
      throw new Error(
        'Could not create keys - Your browser does not support WebCrypto or you are running without SSL enabled.'
      );
    }
    const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readwrite');
    const newTxStore = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);
    newTxStore.put({ id: IDBKeyConfig.KEY_ID, keys });
  }
  return keys;
}

export function getPublicKey(): Promise<PublicKeyWithKid> {
  return new Promise((resolve, reject) => {
    const open = openDb();

    open.onsuccess = function () {
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
          const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey);
          resolve({
            ...publicKey,
            kid: String(IDBKeyConfig.KEY_ID),
            kty: publicKey.kty!,
            e: publicKey.e!,
            n: publicKey.n!,
          });
        } catch (e) {
          reject(e);
        }
      };

      getKeys.onerror = function () {
        reject(getKeys.error);
      };
    };

    open.onerror = function () {
      reject(open.error);
    };
  });
}

export function signPayload(data: ArrayBuffer): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const open = openDb();

    open.onsuccess = function () {
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
          const signature = await crypto.subtle.sign(
            { name: CryptoConfig.name, hash: CryptoConfig.hash },
            keys.privateKey,
            data
          );
          resolve(signature);
        } catch (e) {
          reject(e);
        }
      };

      getKeys.onerror = function () {
        reject(getKeys.error);
      };
    };

    open.onerror = function () {
      reject(open.error);
    };
  });
}

export function verifyPayload(data: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const open = openDb();

    open.onsuccess = function () {
      const db = open.result;
      const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);

      const getKeys = store.get(IDBKeyConfig.KEY_ID) as IDBRequest<{
        id: number;
        keys: CryptoKeyPair;
      }>;

      getKeys.onsuccess = async function () {
        try {
          const key = getKeys.result.keys.publicKey;
          const isValid = await crypto.subtle.verify(
            { name: CryptoConfig.name, hash: CryptoConfig.hash },
            key,
            signature,
            data
          );
          resolve(isValid);
        } catch (e) {
          reject(e);
        }
      };

      getKeys.onerror = function () {
        reject(getKeys.error);
      };
    };

    open.onerror = function () {
      reject(open.error);
    };
  });
}

export const indexedDBKeyStorage: KeyStorage = {
  async getPrivateKey(): Promise<CryptoKey> {
    return new Promise((resolve, reject) => {
      const open = openDb();

      open.onsuccess = function () {
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
            resolve(keys.privateKey);
          } catch (e) {
            reject(e);
          }
        };
      };
    });
  },

  getPublicKey,

  async hasKeys(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const open = openDb();

      open.onsuccess = function () {
        const db = open.result;
        const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);

        const getKeys = store.get(IDBKeyConfig.KEY_ID);

        getKeys.onsuccess = function () {
          resolve(!!getKeys.result?.keys);
        };

        getKeys.onerror = function () {
          reject(getKeys.error);
        };
      };
    });
  },

  async generateKeys(): Promise<CryptoKeyPair> {
    return new Promise((resolve, reject) => {
      const open = openDb();

      open.onsuccess = async function () {
        try {
          const db = open.result;
          const keys = await makeKeys();
          const tx = db.transaction(IDBKeyConfig.OBJECT_STORE_NAME, 'readwrite');
          const store = tx.objectStore(IDBKeyConfig.OBJECT_STORE_NAME);
          store.put({ id: IDBKeyConfig.KEY_ID, keys });
          resolve(keys);
        } catch (e) {
          reject(e);
        }
      };
    });
  },
};
