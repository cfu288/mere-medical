import { Switch } from '@headlessui/react';
import uuid4 from '../../utils/UUIDUtils';
import { useRxDb } from '../providers/RxDbProvider';
import {
  useRawUserPreferences,
  useUserPreferences,
} from '../providers/UserPreferencesProvider';
import { useUser } from '../providers/UserProvider';
import { useRef } from 'react';
import { classNames } from '../../utils/StyleUtils';

export function PrivacyAndSecuritySettingsGroup() {
  const db = useRxDb(),
    user = useUser(),
    userPreferences = useUserPreferences(),
    rawUserPreferences = useRawUserPreferences(),
    ref = useRef<HTMLDivElement | null>(null);

  if (userPreferences !== undefined && rawUserPreferences !== undefined) {
    return (
      <>
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
      </>
    );
  }

  return null;
}
