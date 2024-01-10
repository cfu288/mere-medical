import { useContext, useEffect, useState } from 'react';
import { useLocalConfig } from './LocalConfigProvider';
import { Hook, Unhook } from 'console-feed';
import React from 'react';

// react context provider
export const DeveloperLogsContext = React.createContext<any[]>([]);

export const DeveloperLogsProvider = (props: any) => {
  const [logs, setLogs] = useState<any[]>([]);
  const localConfig = useLocalConfig();

  useEffect(() => {
    if (localConfig.developer_mode_enabled) {
      const hookedConsole = Hook(
        window.console,
        (log) => setLogs((currLogs: any[]) => [...currLogs, log]),
        false,
        200
      );

      return () => {
        Unhook(hookedConsole);
      };
    }

    return () => {};
  }, [localConfig.developer_mode_enabled]);
  return (
    <DeveloperLogsContext.Provider value={logs}>
      {props.children}
    </DeveloperLogsContext.Provider>
  );
};

export function useDeveloperLogs() {
  const logs = useContext(DeveloperLogsContext);
  return logs;
}
