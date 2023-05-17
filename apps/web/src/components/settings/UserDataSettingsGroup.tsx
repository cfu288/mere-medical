import {
  DatabaseCollections,
  handleJSONDataImport,
  useRxDb,
} from '../providers/RxDbProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { ArrowDownTrayIcon } from '@heroicons/react/20/solid';
import { useNotificationDispatch } from '../providers/NotificationProvider';
import { SubmitHandler, useForm } from 'react-hook-form';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import { getFileFromFileList } from '../../pages/SettingsTab';
import { RxDatabase } from 'rxdb';

export type ImportFields = {
  backup?: FileList;
};

export const exportData = (
  db: RxDatabase<DatabaseCollections>,
  setFileDownloadLink: (blob: string) => void
) => {
  db.exportJSON().then((json) => {
    const jsonData = JSON.stringify(json);
    const blobUrl = URL.createObjectURL(
      new Blob([jsonData], { type: 'application/json' })
    );
    setFileDownloadLink(blobUrl);
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
    [backupInProgress, setBackupInProgress] = useState(false);

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

  return (
    <>
      <h1 className="py-6 text-xl font-extrabold">Data</h1>
      <div className="divide-y divide-gray-200">
        <div className="px-4 sm:px-6">
          <ul className="mt-2 divide-y divide-gray-200">
            <li className="flex items-center py-2">
              <div className="flex flex-1 flex-col">
                <h2 className="text-lg font-black leading-6 text-gray-900">
                  Export data
                </h2>
                <p className="pt-2 text-sm text-gray-500">
                  Export all of your data in JSON format. You can use this to
                  backup your data and can import it back if needed.
                </p>
                <p className="pt-2 text-sm text-gray-500">
                  It may take a couple of seconds to prepare the data for
                  download.
                </p>
              </div>
              {fileDownloadLink ? (
                <a href={fileDownloadLink} download="backup.json">
                  <button
                    type="button"
                    className="relative ml-4 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    <ArrowDownTrayIcon
                      className="-ml-1 mr-2 h-5 w-5"
                      aria-hidden="true"
                    />
                    <p className="font-bold">Download Ready</p>
                  </button>
                </a>
              ) : (
                <button
                  type="button"
                  className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 relative ml-4 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                  onClick={() => exportData(db, setFileDownloadLink)}
                >
                  <ArrowRightOnRectangleIcon
                    className="-ml-1 mr-2 h-5 w-5"
                    aria-hidden="true"
                  />
                  <p className="font-bold">Start data export</p>
                </button>
              )}
            </li>
            <li className="flex items-center py-2">
              <div className="flex flex-1 flex-col">
                <h2 className="text-lg font-black leading-6 text-gray-900">
                  Import data
                </h2>
                <p className="pt-2 text-sm text-gray-500">
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
          </ul>
        </div>
      </div>
    </>
  );
}
