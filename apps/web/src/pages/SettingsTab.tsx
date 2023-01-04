import { Switch } from '@headlessui/react';
import uuid4 from 'uuid4';
import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { useRxDb } from '../components/providers/RxDbProvider';
import {
  useRawUserPreferences,
  useUserPreferences,
} from '../components/providers/UserPreferencesProvider';
import { useUser } from '../components/providers/UserProvider';
import { EmptyUserPlaceholder } from '../components/EmptyUserPlaceholder';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const SettingsTab: React.FC = () => {
  const db = useRxDb(),
    user = useUser(),
    userPreferences = useUserPreferences(),
    rawUserPreferences = useRawUserPreferences();

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
            key={user.email || user._id}
            className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white text-center"
          >
            <div className="flex flex-1 flex-col p-8">
              <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                <svg
                  className="h-full w-full rounded-full text-gray-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
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
          <div className="py-6 text-xl font-extrabold">Settings</div>
          <div className="divide-y divide-gray-200">
            <div className="px-4 sm:px-6">
              <ul className="mt-2 divide-y divide-gray-200">
                <Switch.Group
                  as="li"
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex flex-col">
                    <Switch.Label
                      as="p"
                      className="text-lg font-black leading-6 text-gray-900"
                      passive
                    >
                      Use proxy to sync data
                    </Switch.Label>
                    <Switch.Description className="pt-2 text-sm text-gray-500">
                      Some patient portals disable direct communication from the
                      app. If your app fails to login or sync data, you can
                      enable this to use a backend proxy to do actions on your
                      behalf. You should only enable this if you trust the
                      organization hosting the app.
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
                          _id: uuid4(),
                          user_id: user?._id,
                          use_proxy: true,
                        });
                      }
                    }}
                    className={classNames(
                      userPreferences.use_proxy
                        ? 'bg-primary-500'
                        : 'bg-gray-200',
                      'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
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
        </div>
      )}
    </AppPage>
  );
};

export default SettingsTab;
