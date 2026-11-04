/**
 * Stands in for the operating system's color scheme in specs. Installs a
 * `window.matchMedia` whose `(prefers-color-scheme: dark)` query matches when
 * `setDark(true)` was called, and tells listeners when it changes, as a
 * browser does when the system switches between light and dark.
 *
 * @param dark `boolean`. Whether the system starts in dark mode.
 * @returns `{ setDark, listenerCount }`. `setDark` switches the system scheme;
 * `listenerCount` reports how many change listeners are attached.
 *
 * @example
 * const system = mockColorScheme(false);
 * system.setDark(true);
 */
export function mockColorScheme(dark: boolean) {
  let matches = dark;
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: 'change', listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: 'change', listener: () => void) =>
      listeners.delete(listener),
  };
  window.matchMedia = ((media: string) =>
    media === query.media
      ? query
      : {
          matches: false,
          media,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as typeof window.matchMedia;

  return {
    setDark(value: boolean) {
      matches = value;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}
