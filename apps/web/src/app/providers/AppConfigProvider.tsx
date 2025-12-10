import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  PropsWithChildren,
  useCallback,
  useRef,
} from 'react';
import { useRxDb } from './RxDbProvider';
import { useNotificationDispatch } from './NotificationProvider';

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
  HEALOW_CLIENT_ID?: string;
  PUBLIC_URL?: string;
}

interface AppConfigState {
  config: AppConfig;
  isLoading: boolean;
  isStale: boolean;
}

type AppConfigAction =
  | { type: 'LOAD_CACHED'; config: AppConfig }
  | { type: 'LOAD_FRESH'; config: AppConfig }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' };

const INSTANCE_CONFIG_ID = 'instance_config';

const emptyConfig: AppConfig = {};

const initialState: AppConfigState = {
  config: emptyConfig,
  isLoading: true,
  isStale: true,
};

function configReducer(
  state: AppConfigState,
  action: AppConfigAction,
): AppConfigState {
  switch (action.type) {
    case 'LOAD_CACHED':
      return { config: action.config, isLoading: false, isStale: true };
    case 'LOAD_FRESH':
      return { config: action.config, isLoading: false, isStale: false };
    case 'LOAD_COMPLETE':
      return { ...state, isLoading: false };
    case 'LOAD_ERROR':
      return { ...state, isLoading: false };
    default:
      return state;
  }
}

const AppConfigContext = createContext<AppConfigState>(initialState);

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
  const notifyDispatch = useNotificationDispatch();
  const [state, dispatch] = useReducer(configReducer, initialState);
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
          HEALOW_CLIENT_ID: doc.HEALOW_CLIENT_ID,
          PUBLIC_URL: doc.PUBLIC_URL,
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

    let cancelled = false;

    const initConfig = async () => {
      try {
        const cachedConfig = await loadCachedConfig();
        if (cancelled) return;

        if (cachedConfig) {
          dispatch({ type: 'LOAD_CACHED', config: cachedConfig });
        }

        const freshConfig = await configFetcher();
        if (cancelled) return;

        if (freshConfig) {
          dispatch({ type: 'LOAD_FRESH', config: freshConfig });
          await saveConfigToDb(freshConfig);
        } else {
          dispatch({ type: 'LOAD_COMPLETE' });
        }
      } catch (error) {
        console.error('Error initializing config:', error);
        notifyDispatch({
          type: 'set_notification',
          message: 'Failed to load configuration. Some features may not work.',
          variant: 'error',
        });
        dispatch({ type: 'LOAD_ERROR' });
      }
    };

    initConfig();

    return () => {
      cancelled = true;
    };
  }, [loadCachedConfig, configFetcher, saveConfigToDb, notifyDispatch]);

  return (
    <AppConfigContext.Provider value={state}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfigState {
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

export function isConfigValid(config: AppConfig): boolean {
  return !!config.PUBLIC_URL;
}
