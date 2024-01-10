import {
  TutorialLocalStorageKeys,
  useTutorialLocalStorage,
  useUpdateTutorialLocalStorage,
} from '../providers/TutorialConfigProvider';
import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TutorialItemWrapper } from './TutorialItemWrapper';
import { TutorialAddConnectionScreen } from './TutorialAddConnectionScreen';
import { TutorialWelcomeScreen } from './TutorialWelcomeScreen';
import { TutorialInstallPWAScreen } from './TutorialInstallPWAScreen';
import { TutorialCompleteScreen } from './TutorialCompleteScreen';
import { TutorialEnableAnalytics } from './TutorialEnableAnalytics';
import Config from '../../environments/config.json';

export type TutorialState = {
  currentStep: number;
  steps: string[];
  direction: 1 | -1;
  isComplete: boolean;
};

export type TutorialAction =
  | { type: 'initalize_steps'; steps: string[] }
  | { type: 'next_step' }
  | { type: 'previous_step' }
  | { type: 'complete_tutorial' };

export const tutorialReducer: React.Reducer<TutorialState, TutorialAction> = (
  state: TutorialState,
  action: TutorialAction
) => {
  switch (action.type) {
    case 'initalize_steps': {
      return {
        currentStep: 0,
        steps: action.steps,
        direction: 1,
      } as TutorialState;
    }
    case 'next_step': {
      if (state.currentStep >= state.steps.length - 1) {
        return { ...state, isComplete: true };
      }
      return { ...state, currentStep: state.currentStep + 1, direction: 1 };
    }
    case 'previous_step': {
      return {
        ...state,
        currentStep: state.currentStep - 1 < 0 ? 0 : state.currentStep - 1,
        direction: -1,
      };
    }
    case 'complete_tutorial': {
      return { ...state, isComplete: true };
    }
    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
};

/**
 * Experimenting with distilling swipe offset and velocity into a single variable, so the
 * less distance a user has swiped, the more velocity they need to register as a swipe.
 * Should accomodate longer swipes and short flicks without having binary checks on
 * just distance thresholds and velocity > 0.
 */
export const swipeConfidenceThreshold = 5000;
export const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export type ValueOf<T> = T[keyof T];

/**
 * Return all keys in local storage that start with 'tutorial_' in order by unix timestamp
 * @param config
 * @returns
 */
function getTutorialKeysFromLocalStorage<T>(config: Partial<T>): string[] {
  return Object.entries(config)
    .filter(([key, value]) => {
      return key.startsWith('tutorial_') && value !== false;
    })
    .map(([key, _]) => key)
    .sort((a, b) => {
      return a.localeCompare(b);
    });
}

const isInstalledPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches;
};

/**
 * Display a tutorial overlay carousel to the user on app start if localstrage keys are set
 */
export function TutorialOverlay() {
  const tutorialConfig = useTutorialLocalStorage(),
    updateTutorialConfig = useUpdateTutorialLocalStorage(),
    tutorialSteps = useMemo(
      () =>
        getTutorialKeysFromLocalStorage(tutorialConfig)
          .filter((key) =>
            key !== TutorialLocalStorageKeys.INSTALL_PWA
              ? true
              : !isInstalledPWA()
          )
          .filter((key) =>
            key !== TutorialLocalStorageKeys.ENABLE_ANALYTICS
              ? true
              : Config.SENTRY_WEB_DSN &&
                Config.SENTRY_WEB_DSN.includes('SENTRY_WEB_DSN') === false &&
                Config.SENTRY_WEB_DSN.trim() !== ''
          ),
      [tutorialConfig]
    );
  const [state, dispatch] = React.useReducer(tutorialReducer, {
    currentStep: 0,
    steps: [],
    direction: 1,
    isComplete: false,
  } as TutorialState);

  useEffect(() => {
    if (state.isComplete && state.steps.length > 0) {
      // update keys in local storage to false
      const newTutorialState: Record<string, boolean> = {};
      for (const key of state.steps) {
        newTutorialState[key] = false;
      }
      updateTutorialConfig(newTutorialState);
      dispatch({ type: 'initalize_steps', steps: [] });
    }
  }, [state.isComplete, state.steps, updateTutorialConfig]);

  useEffect(() => {
    if (!state.isComplete) {
      dispatch({
        type: 'initalize_steps',
        steps: [...tutorialSteps, TutorialLocalStorageKeys.COMPLETE],
      });
    }
  }, [state.isComplete, tutorialSteps]);

  return (
    <AnimatePresence initial={true}>
      {!tutorialSteps.length || state.isComplete ? null : (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="bg-primary-700 mobile-full-height absolute z-50 flex w-full flex-grow flex-col overflow-hidden opacity-25"
        >
          <AnimatePresence initial={false} custom={state.direction}>
            <TutorialItemWrapper
              key={TutorialLocalStorageKeys.WELCOME_SCREEN}
              localStorageKey={TutorialLocalStorageKeys.WELCOME_SCREEN}
              state={state}
              dispatch={dispatch}
            >
              <TutorialWelcomeScreen dispatch={dispatch} state={state} />
            </TutorialItemWrapper>
            <TutorialItemWrapper
              key={TutorialLocalStorageKeys.INSTALL_PWA}
              localStorageKey={TutorialLocalStorageKeys.INSTALL_PWA}
              state={state}
              dispatch={dispatch}
            >
              <TutorialInstallPWAScreen dispatch={dispatch} />
            </TutorialItemWrapper>
            <TutorialItemWrapper
              key={TutorialLocalStorageKeys.ADD_A_CONNECTION}
              localStorageKey={TutorialLocalStorageKeys.ADD_A_CONNECTION}
              state={state}
              dispatch={dispatch}
            >
              <TutorialAddConnectionScreen dispatch={dispatch} />
            </TutorialItemWrapper>
            <TutorialItemWrapper
              key={TutorialLocalStorageKeys.ENABLE_ANALYTICS}
              localStorageKey={TutorialLocalStorageKeys.ENABLE_ANALYTICS}
              state={state}
              dispatch={dispatch}
            >
              <TutorialEnableAnalytics dispatch={dispatch} />
            </TutorialItemWrapper>
            <TutorialItemWrapper
              key={TutorialLocalStorageKeys.COMPLETE}
              localStorageKey={TutorialLocalStorageKeys.COMPLETE}
              state={state}
              dispatch={dispatch}
            >
              <TutorialCompleteScreen dispatch={dispatch} />
            </TutorialItemWrapper>
            <button
              className="hover:bg-primary-600 mx-auto max-w-sm rounded py-4 px-4 text-white"
              onClick={() => {
                dispatch({ type: 'complete_tutorial' });
              }}
            >
              Skip Tutorial
            </button>
            <TutorialPageCounter
              currentPage={state.currentStep + 1}
              totalPages={state.steps.length}
            />
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TutorialPageCounter({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  return (
    <div
      className={`flex items-center justify-center  ${
        isInstalledPWA() ? 'pb-6' : 'pb-2'
      }`}
    >
      {Array.from({ length: totalPages }).map((_, i) => (
        <div
          key={i}
          className={`mx-1 h-2 w-2 rounded-full ${
            i === currentPage - 1 ? 'bg-white' : 'bg-gray-500'
          }`}
        ></div>
      ))}
    </div>
  );
}
