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
      importJSON: jest.fn(async () => {
        events.push('import');
        return [{ success: { 'test-user': {} }, error: {} }];
      }),
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
    } as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(window, 'setTimeout');
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
    await waitFor(() => expect(target.importJSON).toHaveBeenCalled());
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
    expect(window.setTimeout).not.toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it('keeps the unencrypted mode and shows an error when encryption fails (#449.2)', async () => {
    target.importJSON.mockRejectedValue(new Error('Import failed'));
    await toggle(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(updateConfig).not.toHaveBeenCalled();
    expect(source.remove).not.toHaveBeenCalled();
    expect(window.setTimeout).not.toHaveBeenCalledWith(expect.any(Function), 0);
    expect((screen.getByRole('button', { name: 'Set Password' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('removes the unencrypted source only after encrypted data and mode are saved (#449.3)', async () => {
    await toggle(false);
    await waitFor(() => expect(updateConfig).toHaveBeenCalled());
    expect(source.remove).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['import', 'save', 'config', 'remove-source']);
  });
});
