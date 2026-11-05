import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';

import {
  LocalConfigProvider,
  useLocalConfig,
  useUpdateLocalConfig,
} from './LocalConfigProvider';

// The provider's update function, for calling outside an event handler.
const captured: { update?: ReturnType<typeof useUpdateLocalConfig> } = {};

function ConfigView() {
  const config = useLocalConfig();
  const update = useUpdateLocalConfig();
  useEffect(() => {
    captured.update = update;
  }, [update]);
  return (
    <>
      <button onClick={() => update({ theme: 'dark' })}>
        theme {config.theme}
      </button>
      <output>{JSON.stringify(config)}</output>
    </>
  );
}

function renderProvider() {
  return render(
    <LocalConfigProvider>
      <ConfigView />
    </LocalConfigProvider>,
  );
}

async function renderedConfig() {
  await screen.findByRole('button', { name: /^theme / });
  return JSON.parse(screen.getByRole('status').textContent ?? 'null');
}

// The config the app starts with when nothing is saved.
async function defaultConfig() {
  localStorage.clear();
  const { unmount } = renderProvider();
  const config = await renderedConfig();
  unmount();
  return config;
}

function savedConfig() {
  return JSON.parse(localStorage.getItem('config') ?? 'null');
}

function storageError(): never {
  throw new DOMException('The operation is insecure.', 'SecurityError');
}

describe('LocalConfigProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('resets an unreadable saved config to the defaults', async () => {
    const defaults = await defaultConfig();
    localStorage.setItem('config', '{not json');
    renderProvider();

    expect(await renderedConfig()).toEqual(defaults);
    expect(localStorage.getItem('config')).toBeNull();
  });

  it('saves a change merged with what another tab saved', async () => {
    renderProvider();
    await screen.findByRole('button', { name: 'theme system' });
    localStorage.setItem(
      'config',
      JSON.stringify({ use_encrypted_database: true }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'theme system' }));

    expect(savedConfig()).toMatchObject({
      theme: 'dark',
      use_encrypted_database: true,
    });
  });

  // The defaults say "unencrypted", so falling back to them when the saved
  // config cannot be read would open the wrong database.
  it('fails instead of starting with the defaults when storage cannot be read', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(storageError);

    expect(() => renderProvider()).toThrow('The operation is insecure.');
    expect(screen.queryByRole('status')).toBeNull();
  });

  // Callers such as the encryption toggle reload the page right after a
  // change, so a change that was not saved must not look applied.
  it('throws and keeps the old config when a change cannot be saved', async () => {
    renderProvider();
    const before = await renderedConfig();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(storageError);

    expect(() =>
      act(() => captured.update?.({ use_encrypted_database: true })),
    ).toThrow('The operation is insecure.');
    expect(await renderedConfig()).toEqual(before);
  });
});
