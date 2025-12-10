import React, {
  useRef,
  useContext,
  useCallback,
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';
import {
  AI_DEFAULTS,
  DEFAULT_AI_PROVIDER,
} from '../../features/ai-chat/constants/defaults';

interface LocalConfig {
  use_encrypted_database: boolean;
  developer_mode_enabled?: boolean;
  experimental_features_enabled?: boolean;
  experimental__use_openai_rag?: boolean;
  experimental__openai_api_key?: string;
  experimental__ai_provider?: 'openai' | 'ollama';
  experimental__ollama_endpoint?: string;
  experimental__ollama_model?: string;
  experimental__ollama_embedding_model?: string;
  experimental__ollama_rerank_model?: string;
}

const defaultLocalConfig: LocalConfig = {
  use_encrypted_database: false,
  developer_mode_enabled: false,
  experimental_features_enabled: false,
  experimental__use_openai_rag: false,
  experimental__openai_api_key: '',
  experimental__ai_provider: DEFAULT_AI_PROVIDER,
  experimental__ollama_endpoint: AI_DEFAULTS.OLLAMA.ENDPOINT,
  experimental__ollama_model: AI_DEFAULTS.OLLAMA.MODEL,
  experimental__ollama_embedding_model: AI_DEFAULTS.OLLAMA.EMBEDDING_MODEL,
  experimental__ollama_rerank_model: AI_DEFAULTS.OLLAMA.RERANK_MODEL,
};

function getLocalConfig(): LocalConfig {
  try {
    const raw = localStorage.getItem('config');
    if (!raw) return defaultLocalConfig;
    const parsed = JSON.parse(raw) as Partial<LocalConfig>;
    return { ...defaultLocalConfig, ...parsed };
  } catch {
    // If there's an error parsing, reset to defaults
    localStorage.removeItem('config');
    return defaultLocalConfig;
  }
}

type LocalConfigProviderProps = PropsWithChildren<unknown>;

const LocalConfigContext = React.createContext<LocalConfig>(defaultLocalConfig);
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
  const config = getLocalConfig();
  return config[key];
};

export function LocalConfigProvider(props: LocalConfigProviderProps) {
  const [config, setConfig] = useState<LocalConfig | undefined>(undefined),
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
