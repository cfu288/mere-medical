export function checkIfPersistentStorageAvailable() {
  return (
    !!navigator.storage &&
    !!navigator.storage.persisted &&
    !!navigator.storage &&
    !!navigator.storage.persist
  );
}

export function checkIfQuotaEstimateAvailable() {
  return !!navigator.storage && !!navigator.storage.estimate;
}

export function requestPersistentStorage() {
  if (checkIfPersistentStorageAvailable()) {
    return navigator.storage.persist();
  }
  return Promise.reject('StorageManager not found');
}

export async function checkIfPersistentStorageEnabled() {
  if (checkIfPersistentStorageAvailable()) {
    return await navigator.storage.persisted();
  }
  return Promise.reject('StorageManager not found');
}

export async function getStorageQuota() {
  if (checkIfQuotaEstimateAvailable()) {
    return await navigator.storage.estimate();
  }
  return Promise.reject('StorageManager not found');
}
