import { Switch } from '@headlessui/react';
import uuid4 from '../../../shared/utils/UUIDUtils';
import {
  getInternalLokiStorage,
  getStorageAdapter,
  initEncryptedRxDb,
  initUnencrypedRxDb,
  useRxDb,
} from '../../../app/providers/RxDbProvider';
import {
  useRawUserPreferences,
  useUserPreferences,
} from '../../../app/providers/UserPreferencesProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { useCallback, useRef, useState } from 'react';
import { classNames } from '../../../shared/utils/StyleUtils';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../../../app/providers/LocalConfigProvider';
import { Modal } from '../../../shared/components/Modal';
import { ModalHeader } from '../../../shared/components/ModalHeader';
import { CryptedIndexedDBAdapter } from 'sylviejs/storage-adapter/crypted-indexeddb-adapter';
import { ButtonLoadingSpinner } from '../../connections/components/ButtonLoadingSpinner';

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
                      className="text-primary-800 text-lg leading-6 "
                      passive
                    >
                      Enable encrypted storage with password protection
                    </Switch.Label>
                    <Switch.Description className="pt-2 text-sm text-gray-800">
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
                      'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={classNames(
                        localConfig.use_encrypted_database
                          ? 'translate-x-5'
                          : 'translate-x-0',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
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
                      className="text-primary-800 text-lg leading-6"
                      passive
                    >
                      Use proxy to sync data
                    </Switch.Label>
                    <Switch.Description className="pt-2 text-sm text-gray-800">
                      Some patient portals cannot communicate directly with
                      Mere. This option enables a seperate proxy service to
                      handle login and sync for Mere. Disabling this setting
                      will increase privacy but can break some connections.
                    </Switch.Description>
                    <Switch.Description className="pt-2 text-sm text-gray-800">
                      You should only enable this if you trust the organization
                      hosting the app, as the proxy will be able to access all
                      your health data.
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
                          use_proxy: false,
                        });
                      }
                    }}
                    className={classNames(
                      userPreferences.use_proxy
                        ? 'bg-primary-500'
                        : 'bg-gray-200',
                      'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={classNames(
                        userPreferences.use_proxy
                          ? 'translate-x-5'
                          : 'translate-x-0',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      )}
                    />
                  </Switch>
                </div>
              </Switch.Group>
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
      console.debug(
        'PrivacyAndSecuritySettingsGroup: Migrating from encrypted to unencrypted database',
      );
      const internalStorageAdapter = (await getStorageAdapter(
        db,
      )) as CryptedIndexedDBAdapter;
      const internalDb = await getInternalLokiStorage(db);

      console.debug(
        'PrivacyAndSecuritySettingsGroup: Forcing final write of Loki memory to idb',
      );
      // Force final write of Loki memory to idb
      await new Promise<void>((resolve, reject) =>
        internalDb.saveDatabase((res) => {
          if (res?.success === true) {
            resolve();
          } else if (res) {
            reject(res);
            console.error("'PrivacyAndSecuritySettingsGroup: " + res);
          } else {
            resolve();
          }
        }),
      );

      console.debug(
        'PrivacyAndSecuritySettingsGroup: Exporting current database',
      );
      const json = await db.exportJSON();

      for (const collectionName in json.collections) {
        if (json.collections[collectionName].docs.length === 0) {
          delete json.collections[collectionName];
        }
      }

      console.debug(
        'PrivacyAndSecuritySettingsGroup: Creating new unencrypted database',
      );
      // Create new unencrypted database
      const newDb = await initUnencrypedRxDb();

      console.debug(
        'PrivacyAndSecuritySettingsGroup: Importing data into new unencrypted database',
      );
      // Import data into new database
      await newDb.importJSON(json);
      // Update local config to use unencrypted database

      console.debug(
        'PrivacyAndSecuritySettingsGroup: Deleting old encrypted database',
      );
      await db.remove();
      // We need to fully delete the underlying encrypted loki storage adapter, or we will have issues with re-encrypting the database later
      await (
        internalStorageAdapter as CryptedIndexedDBAdapter
      ).deleteDatabaseAsync('mere_db.db');

      updateLocalConfig({
        use_encrypted_database: false,
      });

      setToggleModal(false);

      setTimeout(() => window.location.reload(), 0);
    } catch (e) {
      console.error(e);
    }
  }, [db, setToggleModal, updateLocalConfig]);

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
          className="focus:ring-primary-500 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300"
          onClick={() => setToggleModal(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className=" bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent px-4 py-2 align-middle text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 disabled:text-gray-800"
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
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const updateLocalConfig = useUpdateLocalConfig();
  const db = useRxDb();

  const submitPassword = useCallback(
    async (password: string) => {
      setIsSettingPassword(true);
      // Migrate current RxDB Dexie database to encrypted database, as seen in RxDBProvider.tsx
      // Export current database
      const json = await db.exportJSON();

      // // if a collection is empty, delete it. Empty collections throw on import in RxDB
      for (const collectionName in json.collections) {
        if (json.collections[collectionName].docs.length === 0) {
          delete json.collections[collectionName];
        }
      }

      try {
        // // Create new encrypted database
        console.debug(
          'PrivacyAndSecuritySettingsGroup: Creating new encrypted database',
        );
        const newEnryptedDb = await initEncryptedRxDb(password);

        console.debug(
          'PrivacyAndSecuritySettingsGroup: Importing data into new encrypted database',
        );
        await newEnryptedDb.importJSON(json);
        console.debug(
          'PrivacyAndSecuritySettingsGroup: Saving new encrypted database to idb',
        );
        const internalDb = await getInternalLokiStorage(newEnryptedDb);

        console.debug(
          'PrivacyAndSecuritySettingsGroup: Forcing final write of Loki memory to idb',
        );

        // Force final write of Loki memory to idb after import
        await new Promise<void>((resolve, reject) =>
          internalDb.saveDatabase((res) => {
            console.debug('PrivacyAndSecuritySettingsGroup: Saving: ' + res);
            if (res?.success === true) {
              resolve();
            } else if (res) {
              reject(res);
              console.error("'PrivacyAndSecuritySettingsGroup: " + res);
            } else {
              resolve();
            }
          }),
        );

        console.debug('PrivacyAndSecuritySettingsGroup: Completed migration');
      } catch (e) {
        console.error(e);
      }

      // // Import data into new database

      // Update local config to use encrypted database
      updateLocalConfig({
        use_encrypted_database: true,
      });

      setIsSettingPassword(true);

      setToggleModal(false);
      setTimeout(() => window.location.reload(), 0);
    },
    [db, setToggleModal, updateLocalConfig],
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
              className="text-primary-900 block text-sm font-medium leading-6"
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
              className="focus:ring-primary-600 text-primary-900 block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-700 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 justify-end px-4 py-4">
          <button
            type="button"
            disabled={isSettingPassword}
            className="focus:ring-primary-500 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 disabled:text-gray-800"
            onClick={() => setToggleModal(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSettingPassword}
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 disabled:text-gray-800"
          >
            <p className={`${isSettingPassword ? 'mr-2' : ''}`}>Set Password</p>
            {isSettingPassword && <ButtonLoadingSpinner />}
          </button>
        </div>
      </form>
    </Modal>
  );
}
