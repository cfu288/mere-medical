import { RadioGroup } from '@headlessui/react';
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/20/solid';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../../../app/providers/LocalConfigProvider';
import { classNames } from '../../../shared/utils/StyleUtils';
import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  ThemePreference,
} from '../../../shared/utils/theme';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  Icon: typeof SunIcon;
}[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: ComputerDesktopIcon },
];

/**
 * Settings for how Mere looks on this device: a light, dark or system theme.
 * The choice is saved per device, with the other local settings.
 *
 * @returns The Appearance settings section.
 *
 * @example
 * <LocalConfigProvider>
 *   <AppearanceSettingsGroup />
 * </LocalConfigProvider>
 */
export function AppearanceSettingsGroup() {
  const { theme } = useLocalConfig();
  const updateLocalConfig = useUpdateLocalConfig();
  const selected = isThemePreference(theme) ? theme : DEFAULT_THEME_PREFERENCE;

  return (
    <>
      <h1 className="py-6 text-xl font-extrabold">Appearance</h1>
      <div className="px-4 sm:px-6">
        <RadioGroup
          id="appearance"
          value={selected}
          onChange={(value: ThemePreference) =>
            updateLocalConfig({ theme: value })
          }
          className="mt-2 flex flex-col pb-4"
        >
          <RadioGroup.Label
            as="h2"
            className="text-primary-800 dark:text-primary-200 text-lg leading-6"
          >
            Theme
          </RadioGroup.Label>
          <RadioGroup.Description className="pt-2 text-sm text-gray-800 dark:text-gray-200">
            System matches your device's light or dark setting.
          </RadioGroup.Description>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <RadioGroup.Option
                key={value}
                value={value}
                className={({ checked, active }) =>
                  classNames(
                    checked
                      ? 'border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-300 dark:bg-primary-950 dark:text-primary-100'
                      : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
                    active ? 'ring-primary-500 ring-2 ring-offset-2' : '',
                    'flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium focus:outline-none dark:ring-offset-gray-950',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <RadioGroup.Label as="span">{label}</RadioGroup.Label>
              </RadioGroup.Option>
            ))}
          </div>
        </RadioGroup>
      </div>
    </>
  );
}
