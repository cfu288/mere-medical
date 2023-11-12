import {
  TutorialLocalStorageKeys,
  useLocalConfig,
} from '../providers/LocalConfigProvider';
import React, { useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TutorialItemWrapper } from './TutorialItemWrapper';
import { TutorialAddConnectionScreen } from './TutorialAddConnectionScreen';
import { TutorialWelcomeScreen } from './TutorialWelcomeScreen';

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
      // update localstorage to mark all keys in  steps as true in localstorage so we don't show the tutorial again
      state.steps.forEach((key) => {
        localStorage.setItem(key, 'true');
      });

      return { ...state, isComplete: true };
    }
    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
};

export const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
};

/**
 * Experimenting with distilling swipe offset and velocity into a single variable, so the
 * less distance a user has swiped, the more velocity they need to register as a swipe.
 * Should accomodate longer swipes and short flicks without having binary checks on
 * just distance thresholds and velocity > 0.
 */
export const swipeConfidenceThreshold = 10000;
export const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export type ValueOf<T> = T[keyof T];

/**
 * Display a tutorial overlay carousel to the user on app start if localstrage keys are set
 */
export function TutorialOverlay() {
  const localConfig = useLocalConfig();
  const tutorialSteps = useMemo(
    () =>
      Object.entries(localConfig)
        .filter(([key, value]) => key.startsWith('tutorial_') && value === true)
        .map(([key, _]) => key)
        .sort((a, b) => {
          return a.localeCompare(b);
        }),
    [localConfig]
  );
  const [state, dispatch] = React.useReducer(tutorialReducer, {
    currentStep: 0,
    steps: [],
    direction: 1,
    isComplete: false,
  } as TutorialState);

  useEffect(() => {
    dispatch({ type: 'initalize_steps', steps: tutorialSteps });
  }, [tutorialSteps]);

  if (!tutorialSteps.length) {
    return null;
  }

  if (state.isComplete) {
    return null;
  }

  return (
    <div className="bg-primary-700 mobile-full-height absolute z-50 w-full overflow-hidden">
      <AnimatePresence initial={false} custom={state.direction}>
        <TutorialItemWrapper
          localStorageKey={TutorialLocalStorageKeys.WELCOME_SCREEN}
          state={state}
          dispatch={dispatch}
        >
          <TutorialWelcomeScreen dispatch={dispatch} />
        </TutorialItemWrapper>
        <TutorialItemWrapper
          localStorageKey={TutorialLocalStorageKeys.ADD_A_CONNECTION}
          state={state}
          dispatch={dispatch}
        >
          <TutorialAddConnectionScreen dispatch={dispatch} />
        </TutorialItemWrapper>
      </AnimatePresence>
    </div>
  );
}
