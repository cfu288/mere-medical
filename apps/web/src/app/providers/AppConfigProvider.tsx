import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
  useCallback,
  useRef,
} from 'react';
import { useRxDb } from './RxDbProvider';

export interface AppConfig {
  ONPATIENT_CLIENT_ID?: string;
  EPIC_CLIENT_ID?: string;
  EPIC_CLIENT_ID_DSTU2?: string;
  EPIC_CLIENT_ID_R4?: string;
  EPIC_SANDBOX_CLIENT_ID?: string;
  EPIC_SANDBOX_CLIENT_ID_DSTU2?: string;
  EPIC_SANDBOX_CLIENT_ID_R4?: string;
  CERNER_CLIENT_ID?: string;
  VERADIGM_CLIENT_ID?: string;
  VA_CLIENT_ID?: string;
  IS_DEMO?: string;
  PUBLIC_URL?: string;
  REDIRECT_URI?: string;
}

interface AppConfigContextValue {
  config: AppConfig;
  isStale: boolean;
}

const INSTANCE_CONFIG_ID = 'instance_config';

const emptyConfig: AppConfig = {};

const defaultContextValue: AppConfigContextValue = {
  config: emptyConfig,
  isStale: true,
};

const AppConfigContext =
  createContext<AppConfigContextValue>(defaultContextValue);

export function AppConfigProvider({ children }: PropsWithChildren) {
  const db = useRxDb();
  const [config, setConfig] = useState<AppConfig>(emptyConfig);
  const [isStale, setIsStale] = useState(true);
  const hasInitialized = useRef(false);

  const fetchConfigFromApi =
    useCallback(async (): Promise<AppConfig | null> => {
      try {
        const response = await fetch('/api/v1/instance-config');
        if (!response.ok) {
          console.warn('Failed to fetch config from API:', response.status);
          return null;
        }
        return await response.json();
      } catch (error) {
        console.warn('Error fetching config from API:', error);
        return null;
      }
    }, []);

  const saveConfigToDb = useCallback(
    async (configData: AppConfig) => {
      try {
        await db.instance_config.upsert({
          id: INSTANCE_CONFIG_ID,
          ...configData,
          updated_at: Date.now(),
        });
      } catch (error) {
        console.warn('Error saving config to RxDB:', error);
      }
    },
    [db],
  );

  const loadCachedConfig = useCallback(async (): Promise<AppConfig | null> => {
    try {
      const cached = await db.instance_config
        .findOne(INSTANCE_CONFIG_ID)
        .exec();
      if (cached) {
        return cached.toJSON() as AppConfig;
      }
      return null;
    } catch (error) {
      console.warn('Error loading cached config from RxDB:', error);
      return null;
    }
  }, [db]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initConfig = async () => {
      const cachedConfig = await loadCachedConfig();

      if (cachedConfig) {
        setConfig(cachedConfig);
        setIsStale(true);
      }

      const freshConfig = await fetchConfigFromApi();

      if (freshConfig) {
        setConfig(freshConfig);
        setIsStale(false);
        await saveConfigToDb(freshConfig);
      }
    };

    initConfig();
  }, [loadCachedConfig, fetchConfigFromApi, saveConfigToDb]);

  return (
    <AppConfigContext.Provider value={{ config, isStale }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfigContextValue {
  const context = useContext(AppConfigContext);
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppConfigProvider');
  }
  return context;
}

export function useConfig(): AppConfig {
  const { config } = useAppConfig();
  return config;
}
