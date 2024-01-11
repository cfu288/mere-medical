import {
  DatabaseCollections,
  handleJSONDataImport,
  useRxDb,
} from '../providers/RxDbProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useNotificationDispatch } from '../providers/NotificationProvider';
import { SubmitHandler, useForm } from 'react-hook-form';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import { getFileFromFileList } from '../../pages/SettingsTab';
import { RxDatabase } from 'rxdb';
import {
  checkIfPersistentStorageAvailable,
  checkIfPersistentStorageEnabled,
  getStorageQuota,
  requestPersistentStorage,
} from '../../utils/storagePermissionUtils';

export type ImportFields = {
  backup?: FileList;
};

export const exportData = (
  db: RxDatabase<DatabaseCollections>,
  setFileDownloadLink: (blob: string) => void
) => {
  return db.exportJSON().then((json) => {
    const jsonData = JSON.stringify(json);
    const blobUrl = URL.createObjectURL(
      new Blob([jsonData], { type: 'application/json' })
    );
    setFileDownloadLink(blobUrl);
    return blobUrl;
  });
};

export const handleImport = (
  fields: ImportFields,
  db: RxDatabase<DatabaseCollections>
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const file = getFileFromFileList(fields.backup);
    const reader = new FileReader();
    if (file) {
      reader.onload = function (event) {
        const jsonData = event.target?.result as string;
        if (jsonData) {
          handleJSONDataImport(jsonData, db)
            .then((result) => {
              resolve(result);
            })
            .catch((error) => {
              reject(error);
            });
        } else {
          reject(Error('The file was empty or unable to be read'));
        }
      };
      reader.onerror = function (error) {
        reject(
          Error('There was an error importing your data' + error.target?.error)
        );
      };
      reader.readAsText(file);
    } else {
      reject(
        Error(
          'There was an error importing your data: Unable to parse file from file list'
        )
      );
    }
  });
};

export function UserDataSettingsGroup() {
  const db = useRxDb(),
    [fileDownloadLink, setFileDownloadLink] = useState(''),
    notifyDispatch = useNotificationDispatch(),
    [backupInProgress, setBackupInProgress] = useState(false),
    [quotaDetails, setQuotaDetails] = useState({} as StorageEstimate),
    [hasPersistentStorageEnabled, setHasPersistentStorageEnabled] =
      useState(false);

  const clickDownloadRef = useRef<HTMLAnchorElement | null>(null);

  const importData: SubmitHandler<ImportFields> = useCallback(
    async (fields) => {
      setBackupInProgress(true);
      try {
        const message = await handleImport(fields, db);
        setBackupInProgress(false);
        notifyDispatch({
          type: 'set_notification',
          message: `${message}, this webpage will be reloaded automatically`,
          variant: 'success',
        });
        setTimeout(() => window.location.reload(), 2000);
      } catch (e) {
        setBackupInProgress(false);
        notifyDispatch({
          type: 'set_notification',
          message: (e as Error).message,
          variant: 'error',
        });
      }
    },
    [db, notifyDispatch]
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { backup: undefined },
  });
  const backupFile = watch('backup');
  const formref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (backupFile) {
      formref.current?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  }, [backupFile]);

  useEffect(() => {
    if (checkIfPersistentStorageAvailable()) {
      getStorageQuota().then((quota) => {
        setQuotaDetails(quota);
      });

      checkIfPersistentStorageEnabled().then((result) => {
        setHasPersistentStorageEnabled(result);
      });
    }
  }, []);

  return (
    <>
      <h1 className="py-6 text-xl font-extrabold">Data</h1>
      <div className="divide-y divide-gray-200">
        <div className="px-4 sm:px-6">
          <ul className="mt-2 divide-y divide-gray-200">
            <li className="flex items-center pb-4">
              <div className="flex flex-1 flex-col">
                <h2 className="text-primary-800 text-lg leading-6">
                  Export data
                </h2>
                <p className="pt-2 text-sm text-gray-700">
                  Export all of your data in JSON format. You can use this to
                  backup your data and can import it back if needed.
                </p>
              </div>
              <button
                type="button"
                className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 relative ml-4 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                onClick={() => {
                  exportData(db, setFileDownloadLink).then((link) => {
                    if (link) {
                      clickDownloadRef.current?.click();
                    }
                  });
                }}
              >
                <ArrowRightOnRectangleIcon
                  className="-ml-1 mr-2 h-5 w-5"
                  aria-hidden="true"
                />
                <p className="font-bold">Export</p>
              </button>
              <a
                ref={clickDownloadRef}
                id="downloadLink"
                download={`mere_export_${new Date().toISOString()}.json`}
                href={fileDownloadLink}
                className="hidden"
              >
                hidden download button
              </a>
            </li>
            <li className="flex items-center py-4">
              <div className="flex flex-1 flex-col">
                <h2 className="text-primary-800 text-lg leading-6">
                  Import data
                </h2>
                <p className="pt-2 text-sm text-gray-700">
                  Import previously exported data
                </p>
              </div>
              <form
                ref={formref}
                onSubmit={handleSubmit(importData)}
                className="border-0"
              >
                <label className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 relative ml-4 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent px-4 py-2 text-sm font-bold  text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2">
                  {getFileFromFileList(backupFile) === undefined
                    ? 'Select backup file'
                    : `${getFileFromFileList(backupFile)?.name} `}
                  <input
                    type="file"
                    id="profilePhoto"
                    accept="application/json"
                    className="hidden"
                    {...register('backup', {
                      required: true,
                      validate: (value, formValues) => value !== undefined,
                    })}
                    aria-invalid={errors.backup ? 'true' : 'false'}
                  />
                  {errors.backup && (
                    <p className="text-red-500">{`${errors.backup?.message}`}</p>
                  )}
                </label>
                {getFileFromFileList(backupFile) !== undefined && (
                  <button
                    type="submit"
                    disabled={backupInProgress}
                    className="relative ml-4 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm  hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:bg-gray-700"
                  >
                    {backupInProgress ? (
                      <>
                        <p className="pr-2">{'Importing'}</p>
                        <ButtonLoadingSpinner />
                      </>
                    ) : (
                      'Start Import'
                    )}
                  </button>
                )}
              </form>
            </li>
            {/* Show storage usage  */}
            <li className="flex items-center py-4">
              <div className="mr-2 flex flex-1 flex-col sm:mr-4">
                <h2 className="text-primary-800 text-lg leading-6">
                  Storage usage
                </h2>
                {/* show if persistant storage is enabled */}
                <p className="pt-2 text-sm text-gray-700">
                  {hasPersistentStorageEnabled
                    ? 'Persistent storage is enabled.'
                    : 'Persistent storage is not enabled - data may be cleared by the browser.'}
                </p>
                {/* Progress bar */}
                {quotaDetails.usage && quotaDetails.quota && (
                  <div className="mt-2 h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-300">
                    <div
                      className="bg-primary-500 h-2.5 min-w-[0.625rem] rounded-full"
                      style={{
                        width: `${
                          (quotaDetails.usage / quotaDetails.quota) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                )}
                <p className="pt-1 text-sm text-gray-700">
                  {quotaDetails.usage && quotaDetails.quota
                    ? `You have used ${
                        quotaDetails.usage >= 1024 * 1024 * 1024
                          ? `${(
                              quotaDetails.usage /
                              1024 /
                              1024 /
                              1024
                            ).toFixed(2)} GB`
                          : `${(quotaDetails.usage / 1024 / 1024).toFixed(
                              2
                            )} MB`
                      } out of ${
                        quotaDetails.quota >= 1024 * 1024 * 1024
                          ? `${(
                              quotaDetails.quota /
                              1024 /
                              1024 /
                              1024
                            ).toFixed(2)} GB`
                          : `${(quotaDetails.quota / 1024 / 1024).toFixed(
                              2
                            )} MB`
                      } of total storage available.`
                    : 'Storage quota not available.'}
                </p>
              </div>
              <div>
                {checkIfPersistentStorageAvailable() &&
                  !hasPersistentStorageEnabled && (
                    <button
                      onClick={() => {
                        requestPersistentStorage().then((result) => {
                          if (result) {
                            notifyDispatch({
                              type: 'set_notification',
                              message: `Persistent storage is enabled.`,
                              variant: 'success',
                            });
                          } else {
                            notifyDispatch({
                              type: 'set_notification',
                              message: `Persistent storage cannot be enabled. Try installing Mere as a PWA to enable persistant storage.`,
                              variant: 'error',
                            });
                          }
                          setHasPersistentStorageEnabled(result);
                        });
                      }}
                      className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 relative mt-2 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent px-4 py-2 text-sm font-bold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                    >
                      Enable
                    </button>
                  )}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
