import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRxDatabase } from 'rxdb';
import { CryptedIndexedDBAdapter } from 'sylviejs/storage-adapter/crypted-indexeddb-adapter';

import {
  LocalConfigProvider,
  useUpdateLocalConfig,
} from './LocalConfigProvider';
import { NotificationProvider } from './NotificationProvider';
import { RxDbProvider } from './RxDbProvider';

jest.mock('rxdb', () => ({
  ...jest.requireActual('rxdb'),
  createRxDatabase: jest.fn(),
}));
jest.mock('sylviejs/storage-adapter/crypted-indexeddb-adapter', () => ({
  CryptedIndexedDBAdapter: jest.fn(() => ({
    loadDatabaseAsync: jest.fn().mockRejectedValue(null),
  })),
}));

const createDatabase = jest.mocked(createRxDatabase);
const openedDatabase = { addCollections: jest.fn() } as unknown as Awaited<
  ReturnType<typeof createRxDatabase>
>;

function EncryptionToggle() {
  const update = useUpdateLocalConfig();
  return (
    <>
      <button onClick={() => update({ use_encrypted_database: true })}>
        encrypt
      </button>
      <button onClick={() => update({ use_encrypted_database: false })}>
        decrypt
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <NotificationProvider>
      <LocalConfigProvider>
        <RxDbProvider>
          <EncryptionToggle />
        </RxDbProvider>
      </LocalConfigProvider>
    </NotificationProvider>,
  );
}

describe('RxDbProvider', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'IS_DEMO', {
      configurable: true,
      value: 'disabled',
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'IS_DEMO');
    jest.restoreAllMocks();
    createDatabase.mockReset();
    jest.mocked(CryptedIndexedDBAdapter).mockClear();
    localStorage.clear();
  });

  it('shows an error with a reload button when the database cannot be opened', async () => {
    createDatabase.mockRejectedValue(new Error('storage unavailable'));
    renderProvider();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'There was an error initializing the database. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'encrypt' })).toBeNull();
  });

  it('ignores a second unlock while the database is opening', async () => {
    localStorage.setItem(
      'config',
      JSON.stringify({ use_encrypted_database: true }),
    );
    createDatabase.mockReturnValue(new Promise(() => undefined));
    renderProvider();
    fireEvent.change(await screen.findByPlaceholderText('Password'), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await act(async () => undefined);

    expect(CryptedIndexedDBAdapter).toHaveBeenCalledTimes(1);
  });

  // The encryption migration changes the setting while the app is open.
  it('keeps the open database mounted when the encryption setting changes', async () => {
    createDatabase.mockResolvedValueOnce(openedDatabase);
    renderProvider();
    const encrypt = await screen.findByRole('button', { name: 'encrypt' });

    fireEvent.click(encrypt);
    expect(screen.getByRole('button', { name: 'encrypt' })).toBe(encrypt);

    createDatabase.mockRejectedValueOnce(new Error('storage unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'decrypt' }));
    await act(async () => undefined);

    expect(screen.getByRole('button', { name: 'encrypt' })).toBe(encrypt);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
