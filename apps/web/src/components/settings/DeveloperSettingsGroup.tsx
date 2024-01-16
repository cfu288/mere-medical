import { useLocalConfig } from '../providers/LocalConfigProvider';
import { useDeveloperLogs } from '../providers/DeveloperLogsProvider';
import { Console } from 'console-feed';

export function DeveloperSettingsGroup() {
  const localConfig = useLocalConfig();

  if (!localConfig.developer_mode_enabled) {
    return null;
  }

  return (
    <>
      <div className="py-6 text-xl font-extrabold">Developer Settings</div>
      {/* Title called title */}
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
