import { Switch, Transition } from '@headlessui/react';
import uuid4 from '../../utils/UUIDUtils';
import {
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
import logoCol from '../../assets/logo.svg';

export function PrivacyAndSecuritySettingsGroup() {
  const db = useRxDb(),
    user = useUser(),
    userPreferences = useUserPreferences(),
    rawUserPreferences = useRawUserPreferences(),
    ref = useRef<HTMLDivElement | null>(null),
    localConfig = useLocalConfig(),
    updateLocalConfig = useUpdateLocalConfig(),
    [toggleModal, setToggleModal] = useState(false);

  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false);

  const migrateFromEncryptedToUnencrypted = useCallback(async () => {
    // Migrate current RxDB encrypted database to unencrypted database, as seen in RxDBProvider.tsx
    // Export current database
    try {
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

      // debugger;
      await db.remove();
      // We need to fully delete the underlying encrypted loki storage adapter, or we will have issues with re-encrypting the database later
      const internalStorageAdapter = await getStorageAdapter(db);
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
                        setToggleModal(true);
                      } else {
                        setLoadingOverlayVisible(true);
                        await migrateFromEncryptedToUnencrypted();
                        setLoadingOverlayVisible(false);
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
            </ul>
          </div>
        </div>
        <DatabasePasswordModal
          toggleModal={toggleModal}
          setToggleModal={setToggleModal}
        />
        {/* Set transparent overlay that is on top of everything with text "Decrypting your data, please wait" */}
        <Transition
          show={loadingOverlayVisible}
          appear={true}
          enter="transition-opacity duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-75"
          leaveFrom="opacity-100"
          leaveTo="opacity-[.99]"
        >
          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center">
              {/* <!-- Background overlay, show/hide based on modal state. --> */}
              <div
                className="bg-primary-700 fixed inset-0 bg-opacity-75 transition-all duration-300"
                aria-hidden="true"
              ></div>
              <div className="flex transform flex-col overflow-hidden rounded-lg bg-white pb-4 text-left align-middle shadow-xl">
                <p className="p-4 text-lg font-bold">Decrypting your data</p>
                <div className="relative h-24 w-24 self-center">
                  <img
                    className="absolute top-0 left-0 h-24 w-24 animate-ping opacity-25"
                    src={logoCol}
                    alt="Loading screen"
                  ></img>
                  <img
                    className="absolute top-0 left-0 h-24 w-24 opacity-25"
                    src={logoCol}
                    alt="Loading screen"
                  ></img>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </>
    );
  }

  return null;
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
      const newDb = await initEncryptedRxDb(password);

      // // Import data into new database
      await newDb.importJSON(json);
      // Update local config to use encrypted database

      await db.remove();
      updateLocalConfig({
        use_encrypted_database: true,
      });

      // Close modal
      setToggleModal(false);
      setTimeout(() => window.location.reload(), 0);
    },
    [db, setToggleModal, updateLocalConfig]
  );

  return (
    <Modal open={toggleModal} setOpen={() => setToggleModal(false)}>
      <ModalHeader
        title="Set database password"
        subtitle="Set a password to encrypt your database with. Note that forgetting your password will prevent you from accessing your data permanently."
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
