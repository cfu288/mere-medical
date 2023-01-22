import { Switch } from '@headlessui/react';
import uuid4 from '../utils/UUIDUtils';
import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { useRxDb } from '../components/providers/RxDbProvider';
import {
  useRawUserPreferences,
  useUserPreferences,
} from '../components/providers/UserPreferencesProvider';
import { useUser } from '../components/providers/UserProvider';
import { EmptyUserPlaceholder } from '../components/EmptyUserPlaceholder';
import { useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { ArrowDownTrayIcon } from '@heroicons/react/20/solid';
import { classNames } from '../utils/StyleUtils';

const SettingsTab: React.FC = () => {
  const db = useRxDb(),
    user = useUser(),
    userPreferences = useUserPreferences(),
    rawUserPreferences = useRawUserPreferences(),
    { pathname, hash, key } = useLocation(),
    ref = useRef<HTMLDivElement | null>(null),
    [fileDownloadLink, setFileDownloadLink] = useState('');

  const exportData = useCallback(() => {
    db.exportJSON().then((json) => {
      const jsonData = JSON.stringify(json);
      const blobUrl = URL.createObjectURL(
        new Blob([jsonData], { type: 'application/json' })
      );
      setFileDownloadLink(blobUrl);
    });
  }, [db]);

  useEffect(() => {
    // if not a hash link, scroll to top
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
  }, [pathname, hash, key]); // do this on route change

  return (
    <AppPage banner={<GenericBanner text="Settings" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
        <div className="py-6 text-xl font-extrabold">About Me</div>
      </div>
      {(user === undefined || user.is_default_user) && (
        <div className="mx-auto flex max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
          <EmptyUserPlaceholder />
        </div>
      )}
      {user !== undefined && !user.is_default_user && (
        <div className="mx-auto mt-2 flex max-w-sm flex-col px-4 sm:px-6 lg:px-8">
          <li
            key={user.email || user.id}
            className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white text-center"
          >
            <div className="flex flex-1 flex-col p-8">
              {user?.profile_picture ? (
                <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                  <img
                    className="h-full w-full rounded-full text-gray-300"
                    src={URL.createObjectURL(user.profile_picture)}
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
                {user.birthday}
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
      {userPreferences !== undefined && rawUserPreferences !== undefined && (
        <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
          <h1 className="py-6 text-xl font-extrabold">Settings</h1>
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
                <li className="flex items-center divide-y divide-gray-200 py-2">
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
                    <a href={fileDownloadLink} download="export.json">
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
                      onClick={() => exportData()}
                    >
                      <ArrowRightOnRectangleIcon
                        className="-ml-1 mr-2 h-5 w-5"
                        aria-hidden="true"
                      />
                      <p className="font-bold">Start data export</p>
                    </button>
                  )}
                </li>
                <li></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </AppPage>
  );
};

export default SettingsTab;
