import React, {
  useRef,
  useContext,
  useCallback,
  PropsWithChildren,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { useLocalConfig } from './LocalConfigProvider';

export const TutorialLocalStorageKeys = {
  WELCOME_SCREEN: 'tutorial_1699756120_welcome-screen',
  INSTALL_PWA: 'tutorial_1699756130_install-pwa',
  ADD_A_CONNECTION: 'tutorial_1699756140_add-a-connection',
  ENABLE_ANALYTICS: 'tutorial_1704513805_enable-analytics',
  COMPLETE: 'tutorial_complete',
} as const;

type TutorialLocalStorage = {
  [TutorialLocalStorageKeys.WELCOME_SCREEN]: boolean;
  [TutorialLocalStorageKeys.INSTALL_PWA]: boolean;
  [TutorialLocalStorageKeys.ADD_A_CONNECTION]: boolean;
  [TutorialLocalStorageKeys.ENABLE_ANALYTICS]: boolean;
  [TutorialLocalStorageKeys.COMPLETE]: boolean;
};

const defaultTutorialLocalStorage: TutorialLocalStorage = {
  [TutorialLocalStorageKeys.WELCOME_SCREEN]: true,
  [TutorialLocalStorageKeys.INSTALL_PWA]: true,
  [TutorialLocalStorageKeys.ADD_A_CONNECTION]: true,
  [TutorialLocalStorageKeys.ENABLE_ANALYTICS]: true,
  [TutorialLocalStorageKeys.COMPLETE]: false,
};

function getTutorialLocalStorage(): TutorialLocalStorage {
  const tutorialConfig = localStorage.getItem('tutorial_config');
  if (tutorialConfig) {
    return { ...defaultTutorialLocalStorage, ...JSON.parse(tutorialConfig) };
  } else {
    localStorage.setItem(
      'tutorial_config',
      JSON.stringify(defaultTutorialLocalStorage)
    );
    return defaultTutorialLocalStorage;
  }
}

const TutorialLocalStorageContext = React.createContext<TutorialLocalStorage>(
  defaultTutorialLocalStorage
);
const UpdateTutorialLocalStorageContext = React.createContext<
  (config: Partial<TutorialLocalStorage>) => void
>(() => {});

export function TutorialConfigProvider(props: PropsWithChildren<unknown>) {
  const [tutorialConfig, setTutorialConfig] = useState<
      TutorialLocalStorage | undefined
    >(undefined),
    hasRun = useRef(false);

  const updateTutorialLocalStorage = useCallback(
    (config: Partial<TutorialLocalStorage>) => {
      const currentConfig = getTutorialLocalStorage();
      const newConfig = { ...currentConfig, ...config };
      localStorage.setItem('tutorial_config', JSON.stringify(newConfig));
      setTutorialConfig(newConfig);
    },
    []
  );

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      setTutorialConfig(getTutorialLocalStorage());
    }
  }, []);

  if (tutorialConfig) {
    return (
      <TutorialLocalStorageContext.Provider value={tutorialConfig}>
        <UpdateTutorialLocalStorageContext.Provider
          value={updateTutorialLocalStorage}
        >
          {props.children}
        </UpdateTutorialLocalStorageContext.Provider>
      </TutorialLocalStorageContext.Provider>
    );
  }

  return null;
}

export function useTutorialLocalStorage() {
  const context = useContext(TutorialLocalStorageContext);
  return context;
}

export function useUpdateTutorialLocalStorage() {
  const context = useContext(UpdateTutorialLocalStorageContext);
  return context;
}
