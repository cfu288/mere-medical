import { Switch } from '@headlessui/react';
import uuid4 from '../../utils/UUIDUtils';
import {
  getInternalLokiStorage,
  getStorageAdapter,
  initEncryptedRxDb,
  initUnencrypedRxDb,
  useRxDb,
} from '../providers/RxDbProvider';
import {
  useRawUserPreferences,
  useUserPreferences,
} from '../providers/UserPreferencesProvider';
import { useUser } from '../providers/UserProvider';
import { useCallback, useRef, useState } from 'react';
import { classNames } from '../../utils/StyleUtils';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../providers/LocalConfigProvider';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { CryptedIndexedDBAdapter } from 'sylviejs/storage-adapter/crypted-indexeddb-adapter';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import Config from '../../environments/config.json';

export function PrivacyAndSecuritySettingsGroup() {
  const db = useRxDb(),
    user = useUser(),
    userPreferences = useUserPreferences(),
    rawUserPreferences = useRawUserPreferences(),
    ref = useRef<HTMLDivElement | null>(null),
    localConfig = useLocalConfig(),
    [showPasswordPrompModal, setShowPasswordPromptModal] = useState(false),
    [showDecryptConfirmModal, setShowDecryptConfirmModal] = useState(false);
  const updateLocalConfig = useUpdateLocalConfig();

  if (userPreferences !== undefined && rawUserPreferences !== undefined) {
    return (
      <>
        <h1 className="py-6 text-xl font-extrabold">Privacy and Security</h1>
        <div className="divide-y divide-gray-200" ref={ref}>
          <div className="px-4 sm:px-6">
            <ul className="mt-2 divide-y divide-gray-200">
              <Switch.Group
                id="encrypt_database"
                as="li"
                className="flex flex-col pb-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Switch.Label
                      as="h2"
                      className="text-lg font-black leading-6 text-gray-900"
                      passive
                    >
                      Enable encrypted storage with password protection
                    </Switch.Label>
                    <Switch.Description className="pt-2 text-sm text-gray-500">
                      Enable password protection of your medical records. Will
                      require you to provide a password before accessing any
                      medical records.
                    </Switch.Description>
                  </div>
                  <Switch
                    checked={localConfig.use_encrypted_database}
                    onChange={async () => {
                      if (localConfig.use_encrypted_database === false) {
                        // If we are enabling encrypted storage, we need to set a password
                        setShowPasswordPromptModal(true);
                      } else {
                        setShowDecryptConfirmModal(true);
                      }
                    }}
                    className={classNames(
                      localConfig.use_encrypted_database
                        ? 'bg-primary-500'
                        : 'bg-gray-200',
                      'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={classNames(
                        localConfig.use_encrypted_database
                          ? 'translate-x-5'
                          : 'translate-x-0',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                </div>
              </Switch.Group>
              <Switch.Group
                id="use_proxy"
                as="li"
                className="flex flex-col py-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Switch.Label
                      as="h2"
                      className="text-lg font-black leading-6 text-gray-900"
                      passive
                    >
                      Use proxy to sync data
                    </Switch.Label>
                    <Switch.Description className="pt-2 text-sm text-gray-500">
                      Some patient portals disable direct communication from the
                      Mere app. If your app fails to login or sync data, you can
                      enable this setting to use a backend proxy to do login and
                      sync on your behalf.
                    </Switch.Description>
                    <Switch.Description className="pt-2 text-sm text-gray-500">
                      You should only enable this if you trust the organization
                      hosting the app, as the proxy will be able to access your
                      health data.
                    </Switch.Description>
                  </div>
                  <Switch
                    checked={userPreferences.use_proxy}
                    onChange={() => {
                      if (rawUserPreferences) {
                        rawUserPreferences.update({
                          $set: {
                            use_proxy: !userPreferences.use_proxy,
                          },
                        });
                      } else {
                        db.user_preferences.insert({
                          id: uuid4(),
                          user_id: user?.id,
                          use_proxy: true,
                        });
                      }
                    }}
                    className={classNames(
                      userPreferences.use_proxy
                        ? 'bg-primary-500'
                        : 'bg-gray-200',
                      'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={classNames(
                        userPreferences.use_proxy
                          ? 'translate-x-5'
                          : 'translate-x-0',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                </div>
              </Switch.Group>
              {Config.SENTRY_WEB_DSN &&
                Config.SENTRY_WEB_DSN.includes('SENTRY_WEB_DSN') === false &&
                Config.SENTRY_WEB_DSN.trim() !== '' && (
                  <Switch.Group
                    id="enable_analytics"
                    as="li"
                    className="flex flex-col py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <Switch.Label
                          as="h2"
                          className="text-lg font-black leading-6 text-gray-900"
                          passive
                        >
                          Enable Analytics
                        </Switch.Label>
                        <Switch.Description className="pt-2 text-sm text-gray-500">
                          Help us understand how you use the app so we can
                          improve your experience. No personally identifiable
                          information is collected.
                        </Switch.Description>
                      </div>
                      <Switch
                        checked={localConfig.use_sentry_reporting}
                        onChange={() => {
                          updateLocalConfig({
                            use_sentry_reporting:
                              !localConfig.use_sentry_reporting,
                          });
                        }}
                        className={classNames(
                          localConfig.use_sentry_reporting
                            ? 'bg-primary-500'
                            : 'bg-gray-200',
                          'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={classNames(
                            localConfig.use_sentry_reporting
                              ? 'translate-x-5'
                              : 'translate-x-0',
                            'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                          )}
                        />
                      </Switch>
                    </div>
                  </Switch.Group>
                )}
            </ul>
          </div>
        </div>
        <DatabasePasswordModal
          toggleModal={showPasswordPrompModal}
          setToggleModal={setShowPasswordPromptModal}
        />
        <PasswordPromptModal
          toggleModal={showDecryptConfirmModal}
          setToggleModal={setShowDecryptConfirmModal}
        />
      </>
    );
  }

  return null;
}

/**
 * Modal that asks for confirmation if a user wants to decrypt their database and remove the password. This is shown when the user untoggles encrypted storage.
 */
function PasswordPromptModal({
  toggleModal,
  setToggleModal,
}: {
  toggleModal: boolean;
  setToggleModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const updateLocalConfig = useUpdateLocalConfig();
  const db = useRxDb();
  const [isProcessing, setIsProcessing] = useState(false);

  const migrateFromEncryptedToUnencrypted = useCallback(async () => {
    // Migrate current RxDB encrypted database to unencrypted database, as seen in RxDBProvider.tsx
    // Export current database
    try {
      const internalStorageAdapter = (await getStorageAdapter(
        db
      )) as CryptedIndexedDBAdapter;
      const internalDb = await getInternalLokiStorage(db);

      // Force final write of Loki memory to idb
      await new Promise<void>((resolve, reject) =>
        internalDb.saveDatabase((res) => {
          if (res?.success === true) {
            resolve();
          } else if (res) {
            reject(res);
          } else {
            resolve();
          }
        })
      );

      const json = await db.exportJSON();

      for (const collectionName in json.collections) {
        if (json.collections[collectionName].docs.length === 0) {
          delete json.collections[collectionName];
        }
      }

      // Create new unencrypted database
      const newDb = await initUnencrypedRxDb();
      // Import data into new database
      await newDb.importJSON(json);
      // Update local config to use unencrypted database

      await db.remove();
      // We need to fully delete the underlying encrypted loki storage adapter, or we will have issues with re-encrypting the database later
      await (
        internalStorageAdapter as CryptedIndexedDBAdapter
      ).deleteDatabaseAsync('mere_db.db');
      updateLocalConfig({
        use_encrypted_database: false,
      });

      setTimeout(() => window.location.reload(), 0);
    } catch (e) {
      console.error(e);
    }
  }, [db, updateLocalConfig]);

  return (
    <Modal open={toggleModal} setOpen={() => setToggleModal(false)}>
      <ModalHeader
        title="Remove password and decrypt data"
        subtitle="Are you sure you want to remove your password? This will decrypt your medical records and you will no longer be prompted to provide a password before seeing your medical records."
        setClose={isProcessing ? undefined : () => setToggleModal(false)}
      />
      <div className="flex flex-shrink-0 justify-end px-4 py-4">
        <button
          type="button"
          disabled={isProcessing}
          className="focus:ring-primary-500 rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300"
          onClick={() => setToggleModal(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className=" bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent py-2 px-4 align-middle text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 disabled:text-gray-700"
          disabled={isProcessing}
          onClick={async () => {
            setIsProcessing(true);
            await migrateFromEncryptedToUnencrypted();
            setIsProcessing(false);
          }}
        >
          <p className={`${isProcessing ? 'mr-2' : ''}`}>Remove Password</p>
          {isProcessing && <ButtonLoadingSpinner />}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Create a modal that allows users to set a password for their database. This is shown when the user enables encrypted storage.
 */
function DatabasePasswordModal({
  toggleModal,
  setToggleModal,
}: {
  toggleModal: boolean;
  setToggleModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [password, setPassword] = useState('');
  const updateLocalConfig = useUpdateLocalConfig();
  const db = useRxDb();

  const submitPassword = useCallback(
    async (password: string) => {
      // Migrate current RxDB Dexie database to encrypted database, as seen in RxDBProvider.tsx
      // Export current database
      const json = await db.exportJSON();

      // // if a collection is empty, delete it. Empty collections throw on import in RxDB
      for (const collectionName in json.collections) {
        if (json.collections[collectionName].docs.length === 0) {
          delete json.collections[collectionName];
        }
      }

      // // Create new encrypted database
      const newEnryptedDb = await initEncryptedRxDb(password);

      // // Import data into new database
      await newEnryptedDb.importJSON(json);

      const internalDb = await getInternalLokiStorage(newEnryptedDb);
      // Force final write of Loki memory to idb after import
      await new Promise<void>((resolve, reject) =>
        internalDb.saveDatabase((res) => {
          if (res?.success === true) {
            resolve();
          } else if (res) {
            reject(res);
          } else {
            resolve();
          }
        })
      );

      // Update local config to use encrypted database
      updateLocalConfig({
        use_encrypted_database: true,
      });

      setToggleModal(false);
      setTimeout(() => window.location.reload(), 0);
    },
    [db, setToggleModal, updateLocalConfig]
  );

  return (
    <Modal open={toggleModal} setOpen={() => setToggleModal(false)}>
      <ModalHeader
        title="Set encryption password"
        subtitle="Set a password to encrypt your medical records with. Note that forgetting your password will prevent you from accessing your data permanently."
        setClose={() => setToggleModal(false)}
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await submitPassword(password);
        }}
        className="w-full"
      >
        <div className="flex w-full flex-shrink-0 justify-end px-4 py-4">
          <div className="w-full">
            <label
              htmlFor="password"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              className="focus:ring-primary-600 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 justify-end px-4 py-4">
          <button
            type="button"
            className="focus:ring-primary-500 rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
            onClick={() => setToggleModal(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            Set Password
          </button>
        </div>
      </form>
    </Modal>
  );
}
