import { Switch } from '@headlessui/react';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUserPreferences } from '../../../app/providers/UserPreferencesProvider';
import { updateUserPreferences } from '../../../repositories/UserPreferencesRepository';
import { useUser } from '../../../app/providers/UserProvider';
import { useRef, useState } from 'react';
import { classNames } from '../../../shared/utils/StyleUtils';
import { useLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { Modal } from '../../../shared/components/Modal';
import { ModalHeader } from '../../../shared/components/ModalHeader';
import { useEncryptionMigration } from '../hooks/useEncryptionMigration';
import { ButtonLoadingSpinner } from '../../connections/components/ButtonLoadingSpinner';

export function PrivacyAndSecuritySettingsGroup() {
  const db = useRxDb(),
    user = useUser(),
    userPreferences = useUserPreferences(),
    ref = useRef<HTMLDivElement | null>(null),
    localConfig = useLocalConfig(),
    [showPasswordPrompModal, setShowPasswordPromptModal] = useState(false),
    [showDecryptConfirmModal, setShowDecryptConfirmModal] = useState(false);

  if (userPreferences !== undefined) {
    return (
      <>
        <h1 className="py-6 text-xl font-extrabold">Privacy and Security</h1>
        <div
          className="divide-y divide-gray-200 dark:divide-gray-700"
          ref={ref}
        >
          <div className="px-4 sm:px-6">
            <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
              <Switch.Group
                id="encrypt_database"
                as="li"
                className="flex flex-col pb-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Switch.Label
                      as="h2"
                      className="text-primary-800 dark:text-primary-200 text-lg leading-6 "
                      passive
                    >
                      Enable encrypted storage with password protection
                    </Switch.Label>
                    <Switch.Description className="pt-2 text-sm text-gray-800 dark:text-gray-200">
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
                        : 'bg-gray-200 dark:bg-gray-700',
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
                      className="text-primary-800 dark:text-primary-200 text-lg leading-6"
                      passive
                    >
                      Use proxy to sync data
                    </Switch.Label>
                    <Switch.Description className="pt-2 text-sm text-gray-800 dark:text-gray-200">
                      Some patient portals cannot communicate directly with
                      Mere. This option enables a seperate proxy service to
                      handle login and sync for Mere. Disabling this setting
                      will increase privacy but can break some connections.
                    </Switch.Description>
                    <Switch.Description className="pt-2 text-sm text-gray-800 dark:text-gray-200">
                      You should only enable this if you trust the organization
                      hosting the app, as the proxy will be able to access all
                      your health data.
                    </Switch.Description>
                  </div>
                  <Switch
                    checked={userPreferences.use_proxy}
                    onChange={() => {
                      updateUserPreferences(db, user.id, {
                        use_proxy: !userPreferences.use_proxy,
                      });
                    }}
                    className={classNames(
                      userPreferences.use_proxy
                        ? 'bg-primary-500'
                        : 'bg-gray-200 dark:bg-gray-700',
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
  const { migrate, isProcessing, error, needsReload } = useEncryptionMigration(
    () => setToggleModal(false),
  );
  const close = () => {
    if (!isProcessing && !needsReload) setToggleModal(false);
  };

  return (
    <Modal open={toggleModal} setOpen={close}>
      <ModalHeader
        title="Remove password and decrypt data"
        subtitle="Are you sure you want to remove your password? This will decrypt your medical records and you will no longer be prompted to provide a password before seeing your medical records."
        setClose={isProcessing || needsReload ? undefined : close}
      />
      <MigrationError error={error} needsReload={needsReload} />
      <div className="flex flex-shrink-0 justify-end px-4 py-4">
        <button
          type="button"
          disabled={isProcessing || needsReload}
          className="focus:ring-primary-500 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600"
          onClick={close}
        >
          Cancel
        </button>
        <button
          type="button"
          className=" bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent px-4 py-2 align-middle text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-800 dark:disabled:text-gray-200"
          disabled={isProcessing || needsReload}
          onClick={() => migrate()}
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
  const { migrate, isProcessing, error, needsReload } = useEncryptionMigration(
    () => setToggleModal(false),
  );
  const close = () => {
    if (!isProcessing && !needsReload) setToggleModal(false);
  };

  return (
    <Modal open={toggleModal} setOpen={close}>
      <ModalHeader
        title="Set encryption password"
        subtitle="Set a password to encrypt your medical records with. Note that forgetting your password will prevent you from accessing your data permanently."
        setClose={isProcessing || needsReload ? undefined : close}
      />
      <MigrationError error={error} needsReload={needsReload} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await migrate(password);
        }}
        className="w-full"
      >
        <div className="flex w-full flex-shrink-0 justify-end px-4 py-4">
          <div className="w-full">
            <label
              htmlFor="password"
              className="text-primary-900 dark:text-primary-200 block text-sm font-medium leading-6"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isProcessing || needsReload}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              className="focus:ring-primary-600 text-primary-900 dark:text-primary-200 block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-700 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 justify-end px-4 py-4">
          <button
            type="button"
            disabled={isProcessing || needsReload}
            className="focus:ring-primary-500 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-800 dark:disabled:text-gray-200"
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isProcessing || needsReload}
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-800 dark:disabled:text-gray-200"
          >
            <p className={`${isProcessing ? 'mr-2' : ''}`}>Set Password</p>
            {isProcessing && <ButtonLoadingSpinner />}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MigrationError({
  error,
  needsReload,
}: {
  error: string;
  needsReload: boolean;
}) {
  if (!error) return null;
  return (
    <div role="alert" className="px-4 py-2 text-red-600 dark:text-red-400">
      <p>{error}</p>
      {needsReload && (
        <button
          type="button"
          className="mt-2 underline"
          onClick={() => window.location.reload()}
        >
          Reload Mere
        </button>
      )}
    </div>
  );
}
