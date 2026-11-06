export type AppKeyParse =
  | { status: 'ok'; key: string }
  | { status: 'missing' }
  | { status: 'wrong-format' };

/**
 * Reads APP_KEY from the environment. The parse trims the value and accepts
 * only the format generate-app-key prints, which is 32 letters, digits, `-` or `_`.
 *
 * @param value - the raw APP_KEY value
 * @returns the key, or why the value is not one
 * @example parseAppKey(' valid-app-key-for-the-test-suite ') // { status: 'ok', key: 'valid-app-key-for-the-test-suite' }
 */
export function parseAppKey(value: string | undefined): AppKeyParse {
  const key = value?.trim() ?? '';
  if (key === '' || key.startsWith('$')) {
    return { status: 'missing' };
  }
  if (!/^[A-Za-z0-9_-]{32}$/.test(key)) {
    return { status: 'wrong-format' };
  }
  return { status: 'ok', key };
}
