import {
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

export type ConfigFetcher = () => Promise<AppConfig | null>;

export const defaultConfigFetcher: ConfigFetcher = async () => {
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
};

interface AppConfigProviderProps extends PropsWithChildren {
  configFetcher?: ConfigFetcher;
}

export function AppConfigProvider({
  children,
  configFetcher = defaultConfigFetcher,
}: AppConfigProviderProps) {
  const db = useRxDb();
  const [config, setConfig] = useState<AppConfig>(emptyConfig);
  const [isStale, setIsStale] = useState(true);
  const hasInitialized = useRef(false);

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
        const doc = cached.toJSON();
        return {
          ONPATIENT_CLIENT_ID: doc.ONPATIENT_CLIENT_ID,
          EPIC_CLIENT_ID: doc.EPIC_CLIENT_ID,
          EPIC_CLIENT_ID_DSTU2: doc.EPIC_CLIENT_ID_DSTU2,
          EPIC_CLIENT_ID_R4: doc.EPIC_CLIENT_ID_R4,
          EPIC_SANDBOX_CLIENT_ID: doc.EPIC_SANDBOX_CLIENT_ID,
          EPIC_SANDBOX_CLIENT_ID_DSTU2: doc.EPIC_SANDBOX_CLIENT_ID_DSTU2,
          EPIC_SANDBOX_CLIENT_ID_R4: doc.EPIC_SANDBOX_CLIENT_ID_R4,
          CERNER_CLIENT_ID: doc.CERNER_CLIENT_ID,
          VERADIGM_CLIENT_ID: doc.VERADIGM_CLIENT_ID,
          VA_CLIENT_ID: doc.VA_CLIENT_ID,
          PUBLIC_URL: doc.PUBLIC_URL,
          REDIRECT_URI: doc.REDIRECT_URI,
        };
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

      const freshConfig = await configFetcher();

      if (freshConfig) {
        setConfig(freshConfig);
        setIsStale(false);
        await saveConfigToDb(freshConfig);
      }
    };

    initConfig();
  }, [loadCachedConfig, configFetcher, saveConfigToDb]);

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
