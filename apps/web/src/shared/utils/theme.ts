/**
 * The color themes a user can choose in Settings. `system` follows the
 * operating system's light or dark setting.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * The theme the page is drawn in after resolving `system`.
 */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'light',
  'dark',
  'system',
];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

/**
 * The media query that matches when the operating system is in dark mode.
 */
export const DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/**
 * Checks that a stored value is one of the theme choices.
 *
 * @param value `unknown`. A value read from storage.
 * @returns `boolean`. True when the value is a `ThemePreference`.
 *
 * @example
 * isThemePreference('dark'); // true
 * isThemePreference('blue'); // false
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

/**
 * Picks the theme to draw from the user's choice and the operating system's
 * setting. An unknown choice falls back to the default, `system`.
 *
 * DO NOT change this without changing the matching script in `index.html`,
 * which applies the same rule before the app loads so the page does not flash
 * in the wrong theme.
 *
 * @param preference `unknown`. The stored choice.
 * @param systemPrefersDark `boolean`. Whether the operating system is in dark mode.
 * @returns `ResolvedTheme`.
 *
 * @example
 * resolveTheme('system', true); // 'dark'
 * resolveTheme('light', true); // 'light'
 */
export function resolveTheme(
  preference: unknown,
  systemPrefersDark: boolean,
): ResolvedTheme {
  const choice = isThemePreference(preference)
    ? preference
    : DEFAULT_THEME_PREFERENCE;
  if (choice === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return choice;
}

/**
 * Draws the page in a theme: toggles Tailwind's `dark` class on the root
 * element and sets `color-scheme`, so native controls and scrollbars match.
 *
 * @param theme `ResolvedTheme`.
 * @param root `HTMLElement`. Defaults to `document.documentElement`.
 * @returns `void`.
 *
 * @example
 * applyTheme('dark');
 */
export function applyTheme(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}
