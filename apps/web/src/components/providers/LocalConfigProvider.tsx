import { get } from 'http';
import React, { useRef, useContext, useCallback } from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';

// Local config stored in local storage, is loaded before the database is.
// This is because the database can be encrypted, and we need to know if it is or not before we can load it.
// Can be also used to store other local config, like if the user has seen the walkthrough or not.
// Things stored in local config are local to the device, and are not synced to other devices.

interface LocalConfig {
  should_show_walkthrough: boolean;
  use_encrypted_database: boolean;
}

const defaultConfig: LocalConfig = {
  should_show_walkthrough: true,
  use_encrypted_database: false,
};

function getConfig(): LocalConfig {
  const config = localStorage.getItem('config');
  if (config) {
    return JSON.parse(config);
  } else {
    localStorage.setItem('config', JSON.stringify(defaultConfig));
    return defaultConfig;
  }
}

type LocalConfigProviderProps = PropsWithChildren<unknown>;

const LocalConfigContext = React.createContext<LocalConfig>(defaultConfig);
const UpdateLocalConfigContext = React.createContext<
  (config: Partial<LocalConfig>) => void
>(() => {});

export function LocalConfigProvider(props: LocalConfigProviderProps) {
  const [config, setConfig] = useState<LocalConfig | undefined>(undefined),
    hasRun = useRef(false);

  /**
   * Update the local config, merges provided config with existing config
   * @param config
   */
  const updateLocalConfig = useCallback((config: Partial<LocalConfig>) => {
    const currentConfig = getConfig();
    const newConfig = { ...currentConfig, ...config };
    localStorage.setItem('config', JSON.stringify(newConfig));
    setConfig(newConfig);
  }, []);

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      setConfig(getConfig());
    }
  }, []);

  if (config) {
    return (
      <LocalConfigContext.Provider value={config}>
        <UpdateLocalConfigContext.Provider value={updateLocalConfig}>
          {props.children}
        </UpdateLocalConfigContext.Provider>
      </LocalConfigContext.Provider>
    );
  }

  return null;
}

/**
 * Use this hook to get the local config
 * @returns
 */
export function useLocalConfig() {
  const context = useContext(LocalConfigContext);
  return context;
}

/**
 * This hook returns a function that merges a provided config with the existing config
 * @returns
 */
export function useUpdateLocalConfig() {
  const context = useContext(UpdateLocalConfigContext);
  return context;
}
