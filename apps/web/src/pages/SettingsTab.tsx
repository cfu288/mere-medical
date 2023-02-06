import { Switch } from '@headlessui/react';
import uuid4 from '../utils/UUIDUtils';
import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import {
  databaseCollections,
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import {
  useRawUserPreferences,
  useUserPreferences,
} from '../components/providers/UserPreferencesProvider';
import { useUser } from '../components/providers/UserProvider';
import { EmptyUserPlaceholder } from '../components/settings/EmptyUserPlaceholder';
import {
  NewUserFormFields,
  EditUserModalForm,
} from '../components/settings/EditUserModalForm';
import { useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { ArrowDownTrayIcon } from '@heroicons/react/20/solid';
import { PencilIcon } from '@heroicons/react/24/outline';
import { classNames } from '../utils/StyleUtils';
import { format } from 'date-fns';
import { RxDatabase, RxDocument, RxDumpDatabaseAny } from 'rxdb';
import { BundleEntry, Patient } from 'fhir/r2';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { SubmitHandler, useForm } from 'react-hook-form';
import { ButtonLoadingSpinner } from '../components/connection/ButtonLoadingSpinner';

function fetchPatientRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string
) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': `patient`,
        user_id: user_id,
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec()
    .then((list) => {
      const lst = (list as unknown) as RxDocument<
        ClinicalDocument<BundleEntry<Patient>>
      >[];
      return lst;
    });
}

function UserCard() {
  const user = useUser(),
    db = useRxDb(),
    [defaultValues, setDefaultValues] = useState<NewUserFormFields | undefined>(
      undefined
    ),
    [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    fetchPatientRecords(db, user.id).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      const firstName = parseGivenName(
          res.filter((i) => parseGivenName(i) !== undefined)?.[0]
        ),
        lastName = parseFamilyName(
          res.filter((i) => parseFamilyName(i) !== undefined)?.[0]
        ),
        email = parseEmail(res.filter((i) => parseEmail(i) !== undefined)?.[0]),
        birthDate = parseBirthday(
          res.filter((i) => parseBirthday(i) !== undefined)?.[0]
        ),
        gender = parseGender(
          res.filter(
            (i) =>
              parseGender(i) !== undefined &&
              parseGender(i)?.toLocaleLowerCase() !== 'unknown'
          )?.[0]
        );

      setDefaultValues({
        firstName,
        lastName,
        email,
        birthday: birthDate,
        gender,
      });
    });
  }, [db, user.id]);

  return (
    <>
      {(user === undefined || user.is_default_user) && (
        <div className="mx-auto flex max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
          <EmptyUserPlaceholder openModal={() => setOpenModal(true)} />
        </div>
      )}
      {user !== undefined && !user.is_default_user && (
        <div className="mx-auto mt-2 flex max-w-sm flex-col px-4 sm:px-6 lg:px-8">
          <li
            key={user.email || user.id}
            className="flex-colrounded-lg relative col-span-1 flex border bg-white text-center"
          >
            <button
              className="absolute top-4 right-4 flex justify-center text-gray-400"
              aria-label="Edit profile"
              onClick={() => {
                setOpenModal(true);
              }}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <div className="flex flex-1 flex-col p-8">
              {user?.profile_picture?.data ? (
                <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                  <img
                    className="h-full w-full rounded-full text-gray-300"
                    src={user.profile_picture.data}
                    alt="profile"
                  ></img>
                </div>
              ) : (
                <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                  <svg
                    className="h-full w-full rounded-full text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              )}
              <h2 className="text-md mt-6 text-start font-medium text-gray-600">
                Name
              </h2>
              <p className="text-md mt-2 text-start font-medium text-gray-900">
                {user.first_name} {user.last_name}
              </p>
              <h2 className="text-md mt-6 text-start font-medium text-gray-600">
                Birthday
              </h2>
              <p className="text-md mt-2 text-start font-medium text-gray-900">
                {user.birthday && format(new Date(user.birthday), 'MM/dd/yyyy')}
              </p>
              <h2 className="text-md mt-6 text-start font-medium text-gray-600">
                Email
              </h2>
              <p className="text-md mt-2 text-start font-medium text-gray-900">
                {user.email}
              </p>
            </div>
          </li>
        </div>
      )}
      <EditUserModalForm
        defaultValues={
          !user.is_default_user
            ? ({
                birthday: user.birthday,
                email: user.email,
                firstName: user.first_name,
                gender: user.gender,
                lastName: user.last_name,
                profilePhoto: user.profile_picture,
              } as NewUserFormFields)
            : defaultValues
        }
        modalOpen={openModal}
        toggleModal={() => setOpenModal((x) => !x)}
      />
    </>
  );
}

function parseGivenName(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.name?.[0].given?.[0];
}

function parseFamilyName(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.name?.[0].family?.[0];
}

function parseEmail(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.telecom?.find(
    (x) => x.system === 'email'
  )?.value;
}

function parseBirthday(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.birthDate;
}

function parseGender(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.gender;
}

function getFileFromFileList(
  fileOrFileList: FileList | File | undefined
): File | undefined {
  let pp: File | null;
  try {
    if (((fileOrFileList as unknown) as FileList).length === 0) {
      return undefined;
    }
    pp = ((fileOrFileList as unknown) as FileList)?.item(0);
    if (pp == null) {
      return undefined;
    }
  } catch (e) {
    pp = (fileOrFileList as unknown) as File;
  }
  return pp;
}

type ImportFields = {
  backup?: FileList;
};

const exportData = (
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

const handleImport = (
  fields: ImportFields,
  db: RxDatabase<DatabaseCollections>
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const file = getFileFromFileList(fields.backup);
    const reader = new FileReader();
    if (file) {
      reader.onload = function (event) {
        const res = event.target?.result;
        if (res) {
          const data = JSON.parse(
            res as string
          ) as RxDumpDatabaseAny<DatabaseCollections>;
          // debugger;
          Promise.all([
            db.collections.clinical_documents.remove(),
            db.collections.connection_documents.remove(),
            db.collections.user_documents.remove(),
            db.collections.user_preferences.remove(),
          ]).then(() => {
            db.addCollections<DatabaseCollections>(databaseCollections).then(
              () => {
                db.importJSON(data)
                  .then((i) => {
                    const res = (i as unknown) as {
                      error: Record<string, RxDocument>;
                      success: Record<string, RxDocument>;
                    }[];
                    let errors = {};
                    let success = {};
                    res.forEach((item) => {
                      errors = { ...errors, ...item.error };
                      success = { ...success, ...item.success };
                    });

                    if (Object.keys(errors).length > 0) {
                      console.group('There were some errors with import:');
                      console.error(errors);
                      console.groupEnd();
                      reject(
                        Error(
                          `${
                            Object.keys(errors).length
                          } documents were not able to be imported`
                        )
                      );
                    } else {
                      resolve(
                        `${
                          Object.keys(success).length
                        } documents were successfully imported`
                      );
                    }
                  })
                  .catch((e) => {
                    reject(
                      Error(
                        'There was an error importing your data' + e.message
                      )
                    );
                  });
              }
            );
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

const SettingsTab: React.FC = () => {
  const db = useRxDb(),
    user = useUser(),
    userPreferences = useUserPreferences(),
    rawUserPreferences = useRawUserPreferences(),
    { pathname, hash, key } = useLocation(),
    ref = useRef<HTMLDivElement | null>(null),
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

  useEffect(() => {
    setTimeout(() => {
      const id = hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest',
        });
      }
    }, 100);
  }, [pathname, hash, key]);

  return (
    <AppPage banner={<GenericBanner text="Settings" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
        <div className="py-6 text-xl font-extrabold">About Me</div>
      </div>

      <UserCard />
      {userPreferences !== undefined && rawUserPreferences !== undefined && (
        <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 pb-12 sm:px-6 lg:px-8">
          <h1 className="py-6 text-xl font-extrabold">Privacy and Security</h1>
          <div className="divide-y divide-gray-200" ref={ref}>
            <div className="px-4 sm:px-6">
              <ul className="mt-2 divide-y divide-gray-200">
                <Switch.Group
                  id="use_proxy"
                  as="li"
                  className="flex items-center justify-between py-4"
                >
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
                </Switch.Group>
              </ul>
            </div>
          </div>
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
                      Export all of your data in JSON format. You can use this
                      to backup your data and can import it back if needed.
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
        </div>
      )}
    </AppPage>
  );
};

export default SettingsTab;
