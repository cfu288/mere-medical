import React, {
  useRef,
  useContext,
  useCallback,
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';

interface LocalConfig {
  use_encrypted_database: boolean;
  use_sentry_reporting: boolean;
  developer_mode_enabled?: boolean;
}

const defaultLocalConfig: LocalConfig = {
  use_encrypted_database: false,
  use_sentry_reporting: false,
  developer_mode_enabled: false,
};

function getLocalConfig(): Partial<LocalConfig> {
  const config = localStorage.getItem('config');
  if (config) {
    return { ...defaultLocalConfig, ...JSON.parse(config) };
  } else {
    localStorage.setItem('config', JSON.stringify(defaultLocalConfig));
    return defaultLocalConfig;
  }
}

type LocalConfigProviderProps = PropsWithChildren<unknown>;

const LocalConfigContext =
  React.createContext<Partial<LocalConfig>>(defaultLocalConfig);
const UpdateLocalConfigContext = React.createContext<
  (config: Partial<LocalConfig>) => void
>(() => {});

/**
 * Helper function that allows you to get a value from the local config
 * Does not update when the config changes
 * @param key
 * @returns
 */
export const getLocalConfigValue = (key: keyof LocalConfig) => {
  const configObject = localStorage.getItem('config');
  if (configObject) {
    const config = JSON.parse(configObject);
    return config[key];
  }
  return undefined;
};

export function LocalConfigProvider(props: LocalConfigProviderProps) {
  const [config, setConfig] = useState<Partial<LocalConfig> | undefined>(
      undefined,
    ),
    hasRun = useRef(false);

  const updateLocalConfig = useCallback((config: Partial<LocalConfig>) => {
    const currentConfig = getLocalConfig();
    const newConfig = { ...currentConfig, ...config };
    localStorage.setItem('config', JSON.stringify(newConfig));
    setConfig(newConfig);
  }, []);

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      const config = getLocalConfig();
      console.debug(config);
      setConfig(config);
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

export function useLocalConfig() {
  const context = useContext(LocalConfigContext);
  return context;
}

export function useUpdateLocalConfig() {
  const context = useContext(UpdateLocalConfigContext);
  return context;
}
