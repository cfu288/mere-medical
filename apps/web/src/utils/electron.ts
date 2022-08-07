export function isElectron() {
  return /electron/i.test(navigator.userAgent);
}
