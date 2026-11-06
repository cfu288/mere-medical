import { useConfig } from '../../../app/providers/AppConfigProvider';
import { useLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { mereAdministrator } from '../../connections/registrationToken';

export function RegistrationTokenSetting() {
  const config = useConfig();
  const localConfig = useLocalConfig();

  if (!config.REGISTRATION_TOKEN_REQUIRED) {
    return null;
  }

  return (
    <li id="registration_token" className="flex flex-col py-4">
      <h2 className="text-primary-800 dark:text-primary-200 text-lg leading-6">
        Registration token
      </h2>
      <p className="pt-2 text-sm text-gray-800 dark:text-gray-200">
        Some vendors, such as Healow, NextGen, and OnPatient, need a
        registration token to connect. Opening the invite link from{' '}
        {mereAdministrator(config)} sets it.
      </p>
      <p className="pt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        {localConfig.registration_token
          ? 'This browser has a registration token.'
          : 'This browser has no registration token yet.'}
      </p>
    </li>
  );
}
