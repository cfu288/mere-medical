import { fireEvent, render, screen } from '@testing-library/react';

import { LocalConfigProvider } from '../../../app/providers/LocalConfigProvider';
import { ThemeController } from '../../../app/providers/ThemeController';
import { mockColorScheme } from '../../../test-utils/matchMedia';
import { AppearanceSettingsGroup } from './AppearanceSettingsGroup';

function renderSettings() {
  render(
    <LocalConfigProvider>
      <ThemeController />
      <AppearanceSettingsGroup />
    </LocalConfigProvider>,
  );
}

const savedTheme = () =>
  JSON.parse(localStorage.getItem('config') ?? '{}').theme;
const isDark = () => document.documentElement.classList.contains('dark');

describe('AppearanceSettingsGroup', () => {
  beforeEach(() => {
    mockColorScheme(false);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('selects System when no theme is saved', async () => {
    renderSettings();

    expect(
      (await screen.findByRole('radio', { name: 'System' })).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
  });

  it('saves a dark theme and sets the dark class', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('radio', { name: 'Dark' }));

    expect(savedTheme()).toBe('dark');
    expect(
      screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(isDark()).toBe(true);
  });

  it('saves a light theme and removes the dark class', async () => {
    localStorage.setItem('config', JSON.stringify({ theme: 'dark' }));
    renderSettings();
    fireEvent.click(await screen.findByRole('radio', { name: 'Light' }));

    expect(savedTheme()).toBe('light');
    expect(isDark()).toBe(false);
  });
});
