import { act, render } from '@testing-library/react';

import { mockColorScheme } from '../../test-utils/matchMedia';
import { LocalConfigProvider } from './LocalConfigProvider';
import { ThemeController } from './ThemeController';

function renderWithTheme(theme?: string) {
  if (theme !== undefined) {
    localStorage.setItem('config', JSON.stringify({ theme }));
  }
  return render(
    <LocalConfigProvider>
      <ThemeController />
    </LocalConfigProvider>,
  );
}

const isDark = () => document.documentElement.classList.contains('dark');

describe('ThemeController', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('follows the system by default, including when it switches', () => {
    const system = mockColorScheme(false);
    renderWithTheme();
    expect(isDark()).toBe(false);

    act(() => system.setDark(true));
    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    act(() => system.setDark(false));
    expect(isDark()).toBe(false);
  });

  it('keeps a chosen light theme when the system is dark', () => {
    const system = mockColorScheme(true);
    renderWithTheme('light');
    expect(isDark()).toBe(false);

    act(() => system.setDark(true));
    expect(isDark()).toBe(false);
  });

  it('keeps a chosen dark theme when the system is light', () => {
    mockColorScheme(false);
    renderWithTheme('dark');
    expect(isDark()).toBe(true);
  });

  it('stops listening to the system when it unmounts', () => {
    const system = mockColorScheme(false);
    const { unmount } = renderWithTheme('system');
    expect(system.listenerCount()).toBe(1);

    unmount();
    expect(system.listenerCount()).toBe(0);
  });
});
