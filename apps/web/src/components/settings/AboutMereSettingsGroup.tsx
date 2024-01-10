import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../providers/LocalConfigProvider';

export function AboutMereSettingsGroup() {
  const localConfig = useLocalConfig(),
    updateLocalConfig = useUpdateLocalConfig();

  return (
    <>
      <div className="py-6 text-xl font-extrabold">About Mere</div>
      {/* App version of MERE_APP_VERSION */}
      <div className="text-sm text-gray-500">Version: {MERE_APP_VERSION}</div>
      {/* Link to github */}
      <div className="text-sm text-gray-500">
        Find the source code on{' '}
        <a
          className="text-primary-500  hover:underline"
          href="https://github.com/cfu288/mere-medical"
        >
          GitHub
        </a>
      </div>
      {/* bug report email at cfu288@meremedical.co */}
      <div className="text-sm text-gray-500">
        Feature requests or bug reports:{' '}
        <a
          className="text-primary-500 hover:text-primary-900 hover:underline"
          href="mailto:cfu288@meremedical.co"
        >
          Send an email
        </a>{' '}
        or{' '}
        <a
          className="text-primary-500 hover:text-primary-900 hover:underline"
          href="https://github.com/cfu288/mere-medical/issues/new"
        >
          Create an issue
        </a>
      </div>
      {/* Made with love by Chris Fu */}
      <div className="text-sm text-gray-500">
        Made with{' '}
        <span role="img" aria-label="love">
          ❤️
        </span>{' '}
        by{' '}
        <a
          className="text-primary-500 hover:text-primary-900 hover:underline"
          href="https://www.cfu288.com"
        >
          Chris Fu
        </a>
      </div>
      <div className="text-sm text-gray-500">
        <button
          className="text-primary-500 hover:text-primary-900 hover:underline"
          onClick={() => {
            updateLocalConfig({
              developer_mode_enabled: !localConfig.developer_mode_enabled,
            });
          }}
        >
          {!localConfig.developer_mode_enabled
            ? 'Enable developer mode'
            : 'Disable developer mode'}{' '}
        </button>
      </div>
    </>
  );
}
