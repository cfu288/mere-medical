import { useLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { useDeveloperLogs } from '../../../app/providers/DeveloperLogsProvider';
import { Console } from 'console-feed';
import { useConfig } from '../../../app/providers/AppConfigProvider';
import {
  describeRequirement,
  isConfigured,
  parseVendorConfig,
  vendorStatusEntries,
  VendorChannel,
} from '@mere/shared';

function channelStatus(channel: VendorChannel) {
  switch (channel.status) {
    case 'production':
      return <span className="text-green-600">Production</span>;
    case 'sandbox-only':
      return <span className="text-yellow-600">Sandbox only</span>;
    case 'disabled':
      return <span className="text-red-500">Not configured</span>;
  }
}

function channelDetail(channel: VendorChannel): string {
  switch (channel.status) {
    case 'production':
      return channel.sandbox
        ? `via ${channel.production.envVar}, sandbox via ${channel.sandbox.envVar}`
        : `via ${channel.production.envVar}`;
    case 'sandbox-only':
      return `via ${channel.sandbox.envVar}`;
    case 'disabled':
      return `set ${describeRequirement(channel.enableWith)} to enable`;
  }
}

export function DeveloperSettingsGroup() {
  const localConfig = useLocalConfig();
  const config = useConfig();
  const providerEntries = vendorStatusEntries(parseVendorConfig(config));

  const buildVars = [
    { name: 'IS_DEMO', value: IS_DEMO },
    { name: 'MERE_APP_VERSION', value: MERE_APP_VERSION },
  ];

  const envVarValues = [
    { name: 'PUBLIC_URL', value: config.PUBLIC_URL },
    { name: 'EPIC_CLIENT_ID', value: config.EPIC_CLIENT_ID },
    { name: 'EPIC_CLIENT_ID_DSTU2', value: config.EPIC_CLIENT_ID_DSTU2 },
    { name: 'EPIC_CLIENT_ID_R4', value: config.EPIC_CLIENT_ID_R4 },
    { name: 'EPIC_SANDBOX_CLIENT_ID', value: config.EPIC_SANDBOX_CLIENT_ID },
    {
      name: 'EPIC_SANDBOX_CLIENT_ID_DSTU2',
      value: config.EPIC_SANDBOX_CLIENT_ID_DSTU2,
    },
    {
      name: 'EPIC_SANDBOX_CLIENT_ID_R4',
      value: config.EPIC_SANDBOX_CLIENT_ID_R4,
    },
    { name: 'CERNER_CLIENT_ID', value: config.CERNER_CLIENT_ID },
    { name: 'VERADIGM_CLIENT_ID', value: config.VERADIGM_CLIENT_ID },
    { name: 'VA_CLIENT_ID', value: config.VA_CLIENT_ID },
    { name: 'ONPATIENT_CLIENT_ID', value: config.ONPATIENT_CLIENT_ID },
    { name: 'HEALOW_CLIENT_ID', value: config.HEALOW_CLIENT_ID },
    { name: 'ATHENA_CLIENT_ID', value: config.ATHENA_CLIENT_ID },
    {
      name: 'ATHENA_SANDBOX_CLIENT_ID',
      value: config.ATHENA_SANDBOX_CLIENT_ID,
    },
    { name: 'NEXTGEN_CLIENT_ID', value: config.NEXTGEN_CLIENT_ID },
  ];

  const envVars = envVarValues.map(({ name, value }) =>
    isConfigured(value)
      ? {
          name,
          configured: true,
          display: value.length > 20 ? `${value.substring(0, 20)}...` : value,
        }
      : { name, configured: false, display: value || '(not set)' },
  );

  if (!localConfig.developer_mode_enabled) {
    return null;
  }

  return (
    <>
      <div className="py-6 text-xl font-extrabold">Developer Settings</div>
      <div className="pb-2 text-lg font-bold">Build Settings</div>
      <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left font-medium">Variable</th>
              <th className="pb-2 text-left font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {buildVars.map((v) => (
              <tr
                key={v.name}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="py-2 font-mono text-xs">{v.name}</td>
                <td className="py-2 font-mono text-xs text-gray-600">
                  {v.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pb-2 text-lg font-bold">Environment Variables</div>
      <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left font-medium">Variable</th>
              <th className="pb-2 text-left font-medium">Status</th>
              <th className="pb-2 text-left font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {envVars.map((env) => (
              <tr
                key={env.name}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="py-2 font-mono text-xs">{env.name}</td>
                <td className="py-2">
                  {env.configured ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-red-500">✗</span>
                  )}
                </td>
                <td className="py-2 font-mono text-xs text-gray-600">
                  {env.display}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pb-2 text-lg font-bold">Provider Status</div>
      <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left font-medium">Provider</th>
              <th className="pb-2 text-left font-medium">Status</th>
              <th className="pb-2 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {providerEntries.map((entry) => (
              <tr
                key={entry.label}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="py-2 text-xs">{entry.label}</td>
                <td className="py-2 text-xs">{channelStatus(entry.channel)}</td>
                <td className="py-2 font-mono text-xs text-gray-600">
                  {channelDetail(entry.channel)}
                  {entry.note ? ` — ${entry.note}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pb-2 text-lg font-bold">Console</div>
      <div className="h-96 overflow-y-auto rounded shadow-inner">
        <LogsContainer />
      </div>
      <div className="pb-2 pt-4 text-lg font-bold">Refresh Page</div>
      <button
        className="bg-primary-500 hover:bg-primary-700 rounded px-4 py-2 font-bold text-white"
        onClick={() => {
          window.location.replace(window.location.href);
        }}
      >
        Refresh
      </button>
      <div className="pb-2 pt-4 text-lg font-bold">Throw test exception</div>
      <button
        className="bg-red-500 hover:bg-red-700 rounded px-4 py-2 font-bold text-white"
        onClick={() => {
          setTimeout(() => {
            throw new Error('This is a sample error used for debugging');
          });
        }}
      >
        Throw error
      </button>
    </>
  );
}
const LogsContainer = () => {
  const logs = useDeveloperLogs();

  return <Console logs={logs} variant="light" />;
};
