export function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persistent) => {
      if (persistent) {
        console.log(
          'Storage will not be cleared except by explicit user action'
        );
      } else {
        console.log('Storage may be cleared by the UA under storage pressure.');
      }
    });
  }
}

export function checkIfPersistentStorageAvailable() {
  return !!navigator.storage && !!navigator.storage.persisted;
}

export async function checkPersistentStorage() {
  if (navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted();
  }
  return Promise.reject('StorageManager not found');
}

export async function getStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    return await navigator.storage.estimate();
  }
  return Promise.reject('StorageManager not found');
}
