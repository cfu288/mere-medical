import { readFileSync } from 'fs';
import { join } from 'path';

import { mockColorScheme } from '../../test-utils/matchMedia';
import { applyTheme, isThemePreference, resolveTheme } from './theme';

describe('isThemePreference', () => {
  it.each(['light', 'dark', 'system'])('accepts %s', (value) => {
    expect(isThemePreference(value)).toBe(true);
  });

  it.each(['blue', '', undefined, null, 1])('rejects %p', (value) => {
    expect(isThemePreference(value)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
    [undefined, true, 'dark'],
    ['blue', false, 'light'],
  ])('draws %p with a dark system=%p in %s', (preference, dark, expected) => {
    expect(resolveTheme(preference, dark)).toBe(expected);
  });
});

describe('applyTheme', () => {
  it('adds the dark class and color scheme, then removes them', () => {
    const root = document.createElement('html');

    applyTheme('dark', root);
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');

    applyTheme('light', root);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('the theme-init script in index.html', () => {
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  const script = html.match(
    /<script id="theme-init">([\s\S]*?)<\/script>/,
  )?.[1];
  // Runs the inline script the way the browser does before the app loads:
  // jsdom executes a script element when it is added to the document.
  const runThemeInit = () => {
    const element = document.createElement('script');
    element.textContent = script ?? '';
    document.head.appendChild(element);
    element.remove();
  };

  afterEach(() => {
    localStorage.clear();
    applyTheme('light');
  });

  it('is in index.html', () => {
    expect(script).toBeDefined();
  });

  it.each([
    [undefined, false],
    [undefined, true],
    ['light', true],
    ['dark', false],
    ['system', false],
    ['system', true],
    ['blue', true],
  ])(
    'draws a saved theme of %p with a dark system=%p the same way resolveTheme does',
    (theme, dark) => {
      mockColorScheme(dark);
      if (theme !== undefined) {
        localStorage.setItem('config', JSON.stringify({ theme }));
      }

      runThemeInit();

      const expected = resolveTheme(theme, dark);
      expect(document.documentElement.classList.contains('dark')).toBe(
        expected === 'dark',
      );
      expect(document.documentElement.style.colorScheme).toBe(expected);
    },
  );

  it('falls back to the system theme when the saved config is unreadable', () => {
    mockColorScheme(true);
    localStorage.setItem('config', '{not json');

    runThemeInit();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
