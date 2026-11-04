import { useEffect } from 'react';
import { useLocalConfig } from './LocalConfigProvider';
import {
  applyTheme,
  DARK_COLOR_SCHEME_QUERY,
  resolveTheme,
} from '../../shared/utils/theme';

/**
 * Keeps the page in the theme chosen in Settings. With `system` it follows the
 * operating system, including when the system switches while Mere is open.
 * The theme-init script in `index.html` applies the saved theme before this
 * mounts, so the page does not flash in the wrong theme on load.
 *
 * Must be rendered inside `LocalConfigProvider`.
 *
 * @returns `null`. Renders nothing.
 *
 * @example
 * <LocalConfigProvider>
 *   <ThemeController />
 * </LocalConfigProvider>
 */
export function ThemeController() {
  const { theme } = useLocalConfig();

  useEffect(() => {
    const media = window.matchMedia?.(DARK_COLOR_SCHEME_QUERY);
    const apply = () => applyTheme(resolveTheme(theme, !!media?.matches));
    apply();
    if (!media) {
      return undefined;
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
}
