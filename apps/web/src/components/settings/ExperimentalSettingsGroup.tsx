import { Switch } from '@headlessui/react';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../providers/LocalConfigProvider';
import { classNames } from '../../utils/StyleUtils';
import { useEffect, useState } from 'react';
import { useNotificationDispatch } from '../providers/NotificationProvider';

export function ExperimentalSettingsGroup() {
  const { experimental__openai_api_key, experimental__use_openai_rag } =
    useLocalConfig();
  const updateLocalConfig = useUpdateLocalConfig();
  const [openApiKey, setOpenApiKey] = useState('');
  const notificationDispatch = useNotificationDispatch();

  useEffect(() => {
    setOpenApiKey(experimental__openai_api_key || '');
  }, [experimental__openai_api_key]);

  return (
    <>
      <h1 className="py-6 text-xl font-extrabold">Experimental</h1>
      <div className="divide-y divide-gray-200">
        <div className="px-4 sm:px-6">
          <ul className="mt-2 ">
            <Switch.Group
              id="experimental__use_rag"
              as="li"
              className="flex flex-col pb-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Switch.Label
                    as="h2"
                    className="text-primary-800 text-lg leading-6"
                    passive
                  >
                    Enable Mere AI Assistant
                  </Switch.Label>
                  <Switch.Description className="pt-2 text-sm text-gray-800">
                    Enable Mere to use OpenAIs models for improved search and
                    Q&A features.
                  </Switch.Description>
                  <Switch.Description className="pt-2 text-sm text-red-800">
                    <b>WARNING</b>: Enabling this feature will send your medical
                    records to OpenAI for processing.
                  </Switch.Description>
                </div>
                <Switch
                  disabled={experimental__openai_api_key === ''}
                  checked={experimental__use_openai_rag}
                  onChange={() => {
                    updateLocalConfig({
                      experimental__use_openai_rag:
                        !experimental__use_openai_rag,
                    });
                  }}
                  className={classNames(
                    experimental__use_openai_rag
                      ? 'bg-primary-500'
                      : 'bg-gray-200',
                    'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      experimental__use_openai_rag
                        ? 'translate-x-5'
                        : 'translate-x-0',
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    )}
                  />
                </Switch>
              </div>
            </Switch.Group>
            {/* password input api key */}
            <form className="w-full flex">
              <input
                type="password"
                className="bg-gray-50 rounded-md p-2 w-full border-none focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent active:ring-2 active:ring-primary-600"
                placeholder="OpenAI API Key"
                defaultValue={experimental__openai_api_key || ''}
                value={openApiKey}
                onChange={(e) => {
                  setOpenApiKey(e.target.value);
                }}
              />
              <button
                type="submit"
                // primary color
                className="relative ml-4 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm  hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:bg-gray-700"
                onClick={(e) => {
                  e.preventDefault();
                  updateLocalConfig({
                    experimental__openai_api_key: openApiKey,
                  });
                  notificationDispatch({
                    type: 'set_notification',
                    variant: 'success',
                    message: 'OpenAI API Key saved',
                  });
                }}
              >
                Save
              </button>
            </form>
          </ul>
        </div>
      </div>
    </>
  );
}
