import { useMemo } from 'react';
import { useConfig } from '../../../app/providers/AppConfigProvider';
import { useLocalConfig } from '../../../app/providers/LocalConfigProvider';
import {
  parseVendorConfig,
  vendorStatusEntries,
  VendorChannel,
} from '../../../app/providers/vendorConfig';

function StatusBadge({ channel }: { channel: VendorChannel }) {
  switch (channel.status) {
    case 'production':
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Production
        </span>
      );
    case 'sandbox-only':
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
          Sandbox only
        </span>
      );
    case 'disabled':
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          Not configured
        </span>
      );
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
      return `set ${channel.enableWith.join(' or ')} to enable`;
  }
}

export function ProviderStatusSettingsGroup() {
  const config = useConfig();
  const localConfig = useLocalConfig();
  const entries = useMemo(
    () => vendorStatusEntries(parseVendorConfig(config), config),
    [config],
  );

  if (!localConfig.developer_mode_enabled) {
    return null;
  }

  return (
    <>
      <div className="py-6 text-xl font-extrabold">Provider Connections</div>
      <div className="pb-4 text-sm font-medium text-gray-800">
        Which health record providers this instance can connect to, based on its
        configuration.
      </div>
      <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4">
        <ul className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <li
              key={entry.label}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">
                  {entry.label}
                </span>
                <span className="text-xs text-gray-600">
                  {channelDetail(entry.channel)}
                  {entry.note ? ` — ${entry.note}` : ''}
                </span>
              </div>
              <StatusBadge channel={entry.channel} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
