import React from 'react';
import { TutorialAction } from './TutorialOverlay';
import { TutorialContentScreen } from './TutorialContentScreen';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../providers/LocalConfigProvider';
import { classNames } from '../../utils/StyleUtils';
import { Switch } from '@headlessui/react';

export function TutorialEnableAnalytics({
  dispatch,
}: {
  dispatch: React.Dispatch<TutorialAction>;
}) {
  const localConfig = useLocalConfig();
  const updateLocalConfig = useUpdateLocalConfig();

  return (
    <TutorialContentScreen dispatch={dispatch}>
      <h1 className="mb-2 text-center text-xl font-semibold">
        Enable Analytics and Crash Reporting?
      </h1>
      <div className="mx-auto self-center justify-self-center rounded-lg p-2 align-middle sm:max-w-lg">
        <p className="mb-2">
          Mere uses analytics to help us catch bugs and improve the app. We do
          not collect any personally identifiable information.
        </p>
        {/* Center div */}
        <div className="flex w-full flex-col items-center justify-center pt-16 align-middle">
          {/* Switch toggle  */}
          <Switch.Group
            id="enable_analytics"
            as="div"
            className="relative inline-block select-none align-middle transition duration-200 ease-in"
          >
            <Switch
              className={classNames(
                localConfig?.use_sentry_reporting
                  ? 'bg-primary-500'
                  : 'bg-gray-200',
                'focus:ring-primary-500 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2'
              )}
              checked={localConfig?.use_sentry_reporting}
              onChange={(checked: boolean) => {
                updateLocalConfig({
                  use_sentry_reporting: checked,
                });
              }}
            >
              <span
                aria-hidden="true"
                className={classNames(
                  localConfig?.use_sentry_reporting
                    ? 'translate-x-5'
                    : 'translate-x-0',
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                )}
              />
            </Switch>
            <Switch.Label
              as="h2"
              passive
              className="cursor-pointer overflow-hidden rounded-full bg-gray-300"
            ></Switch.Label>
          </Switch.Group>
          <p
            className={`mt-4 rounded-full px-2 py-1 text-center text-gray-500 transition-colors ${
              localConfig?.use_sentry_reporting
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {localConfig?.use_sentry_reporting ? (
              <>
                {'Analytics is currently '} <b>enabled</b>
              </>
            ) : (
              <>
                {'Analytics is currently '} <b>disabled</b>
              </>
            )}
          </p>
        </div>
      </div>
    </TutorialContentScreen>
  );
}
