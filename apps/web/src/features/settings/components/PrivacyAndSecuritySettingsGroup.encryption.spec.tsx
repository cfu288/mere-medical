import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  getInternalLokiStorage,
  getStorageAdapter,
  initEncryptedRxDb,
  initUnencrypedRxDb,
  useRxDb,
} from '../../../app/providers/RxDbProvider';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../../../app/providers/LocalConfigProvider';
import { PrivacyAndSecuritySettingsGroup } from './PrivacyAndSecuritySettingsGroup';

jest.mock('../../../app/providers/RxDbProvider');
jest.mock('../../../app/providers/LocalConfigProvider');
jest.mock('../../../app/providers/UserProvider', () => ({
  useUser: () => ({ id: 'test-user' }),
}));
jest.mock('../../../app/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({ use_proxy: false }),
}));
jest.mock('../../../repositories/UserPreferencesRepository');
jest.mock('../../../shared/components/Modal', () => ({
  Modal: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) =>
    open ? <div role="dialog">{children}</div> : null,
}));
jest.mock('../../../shared/components/ModalHeader', () => ({
  ModalHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

describe('encryption toggle', () => {
  let events: string[];
  let source: ReturnType<typeof makeDatabase>;
  let target: ReturnType<typeof makeDatabase>;
  let updateConfig: jest.Mock;
  let saveDatabase: jest.Mock;
  let deleteDatabaseAsync: jest.Mock;

  function makeDatabase(name: string) {
    const dump = {
      name: 'mere_db',
      collections: [{ name: 'user_documents', docs: [{ id: 'test-user' }] }],
    };
    return {
      exportJSON: jest.fn().mockResolvedValue(dump),
      importJSON: jest.fn(
        async (): Promise<
          { success: Record<string, unknown>; error: Record<string, unknown> }[]
        > => {
          events.push('import');
          return [{ success: { 'test-user': {} }, error: {} }];
        },
      ),
      remove: jest.fn(async () => {
        events.push(`remove-${name}`);
      }),
      destroy: jest.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    events = [];
    source = makeDatabase('source');
    target = makeDatabase('target');
    updateConfig = jest.fn(() => events.push('config'));
    saveDatabase = jest.fn((callback) => {
      events.push('save');
      callback();
    });
    deleteDatabaseAsync = jest.fn(async () => events.push('delete-loki'));
    jest.mocked(useRxDb).mockReturnValue(source as never);
    jest.mocked(useUpdateLocalConfig).mockReturnValue(updateConfig);
    jest.mocked(initEncryptedRxDb).mockResolvedValue(target as never);
    jest.mocked(initUnencrypedRxDb).mockResolvedValue(target as never);
    jest.mocked(getInternalLokiStorage).mockResolvedValue({
      saveDatabase,
    } as never);
    jest.mocked(getStorageAdapter).mockResolvedValue({
      deleteDatabaseAsync,
      getDatabaseListAsync: jest.fn().mockResolvedValue(['mere_db.db']),
    } as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function toggle(encrypted: boolean) {
    jest.mocked(useLocalConfig).mockReturnValue({
      use_encrypted_database: encrypted,
    });
    render(<PrivacyAndSecuritySettingsGroup />);
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Enable encrypted storage with password protection',
      }),
    );
    if (!encrypted) {
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'test-password' },
      });
    }
    fireEvent.click(
      screen.getByRole('button', {
        name: encrypted ? 'Remove Password' : 'Set Password',
      }),
    );
  }

  it('keeps the encrypted source when saving the unencrypted mode fails (#449.1)', async () => {
    updateConfig.mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    await toggle(true);
    await waitFor(() => expect(updateConfig).toHaveBeenCalled());
    expect(source.remove).not.toHaveBeenCalled();
    expect(deleteDatabaseAsync).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/unable/i);
  });

  it('keeps the unencrypted mode and shows an error when encryption fails (#449.2)', async () => {
    target.importJSON.mockRejectedValue(new Error('Import failed'));
    await toggle(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(updateConfig).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole('button', {
          name: 'Set Password',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('removes the unencrypted source only after encrypted data and mode are saved (#449.3)', async () => {
    await toggle(false);
    await waitFor(() => expect(source.remove).toHaveBeenCalled());
    expect(source.remove).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['import', 'save', 'config', 'remove-source']);
  });

  it.each(['export', 'create', 'import', 'save', 'config'])(
    'preserves the plaintext source on an encryption %s failure',
    async (stage) => {
      if (stage === 'export') source.exportJSON.mockRejectedValue(new Error());
      if (stage === 'create')
        jest.mocked(initEncryptedRxDb).mockRejectedValue(new Error());
      if (stage === 'import') target.importJSON.mockRejectedValue(new Error());
      if (stage === 'save')
        saveDatabase.mockImplementation((callback) => callback(new Error()));
      if (stage === 'config')
        updateConfig.mockImplementation(() => {
          throw new Error();
        });

      await toggle(false);
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
      expect(source.remove).not.toHaveBeenCalled();
      if (stage !== 'config') expect(updateConfig).not.toHaveBeenCalled();
      expect(
        (
          screen.getByRole('button', {
            name: 'Set Password',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
      if (['import', 'save', 'config'].includes(stage)) {
        expect(target.remove).toHaveBeenCalledTimes(1);
        expect(deleteDatabaseAsync).toHaveBeenCalledWith('mere_db.db');
      }
    },
  );

  it('rejects a resolved import containing document errors', async () => {
    target.importJSON.mockResolvedValue([
      { success: {}, error: { 'test-user': { status: 409 } } },
    ]);
    await toggle(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(updateConfig).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
    expect(target.remove).toHaveBeenCalledTimes(1);
  });

  it('waits for encrypted persistence before committing the mode', async () => {
    let finishSave: (result?: unknown) => void = () => undefined;
    saveDatabase.mockImplementation((callback) => {
      events.push('save');
      finishSave = callback;
    });
    await toggle(false);
    await waitFor(() => expect(saveDatabase).toHaveBeenCalled());
    expect(updateConfig).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
    finishSave({ success: true });
    await waitFor(() => expect(source.remove).toHaveBeenCalled());
    expect(events).toEqual(['import', 'save', 'config', 'remove-source']);
  });

  it('removes the encrypted source last after a successful decryption', async () => {
    await toggle(true);
    await waitFor(() => expect(deleteDatabaseAsync).toHaveBeenCalled());
    expect(updateConfig).toHaveBeenCalledWith({
      use_encrypted_database: false,
    });
    expect(events).toEqual([
      'save',
      'import',
      'config',
      'remove-source',
      'delete-loki',
    ]);
  });

  it('keeps the encrypted source on a decryption import failure', async () => {
    target.importJSON.mockRejectedValue(new Error());
    await toggle(true);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(updateConfig).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
    expect(target.remove).toHaveBeenCalled();
    expect(deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('aborts before creating a target when saving the encrypted source fails', async () => {
    saveDatabase.mockImplementation((callback) => callback({ success: false }));
    await toggle(true);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(initUnencrypedRxDb).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
  });

  it('keeps the committed target selected if source cleanup fails', async () => {
    source.remove.mockRejectedValue(new Error());
    await toggle(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(updateConfig).toHaveBeenCalledTimes(1);
    expect(updateConfig).toHaveBeenCalledWith({ use_encrypted_database: true });
    expect(target.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/unencrypted copy/);
    expect(screen.getByRole('button', { name: 'Reload Mere' })).toBeTruthy();
  });

  it('requires a reload if an incomplete target cannot be cleaned up', async () => {
    target.importJSON.mockRejectedValue(new Error());
    target.remove.mockRejectedValue(new Error());
    await toggle(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(updateConfig).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/incomplete copy/);
    expect(screen.getByRole('button', { name: 'Reload Mere' })).toBeTruthy();
  });

  it('allows a retry after discarding a failed migration', async () => {
    target.importJSON.mockRejectedValueOnce(new Error());
    await toggle(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }));
    await waitFor(() => expect(source.remove).toHaveBeenCalled());
    expect(initEncryptedRxDb).toHaveBeenCalledTimes(2);
    expect(updateConfig).toHaveBeenCalledTimes(1);
  });

  it('does not try to delete an encrypted file that was never saved', async () => {
    target.importJSON.mockRejectedValue(new Error());
    jest.mocked(getStorageAdapter).mockResolvedValue({
      getDatabaseListAsync: jest.fn().mockResolvedValue([]),
      deleteDatabaseAsync,
    } as never);
    await toggle(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(deleteDatabaseAsync).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
  });

  it('retains the unencrypted mode if deleting the old encrypted file fails', async () => {
    deleteDatabaseAsync.mockRejectedValue(new Error());
    await toggle(true);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(updateConfig).toHaveBeenCalledTimes(1);
    expect(updateConfig).toHaveBeenCalledWith({
      use_encrypted_database: false,
    });
    expect(target.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reload Mere' })).toBeTruthy();
  });
});
