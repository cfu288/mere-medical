import { TutorialLocalStorageKeys } from '../providers/LocalConfigProvider';
import React, { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';
import {
  ValueOf,
  TutorialState,
  TutorialAction,
  variants,
  swipePower,
  swipeConfidenceThreshold,
} from './TutorialOverlay';

export const TutorialItemWrapper = ({
  localStorageKey,
  children,
  state,
  dispatch,
}: PropsWithChildren<{
  localStorageKey: ValueOf<typeof TutorialLocalStorageKeys>;
  state: TutorialState;
  dispatch: React.Dispatch<TutorialAction>;
}>) => {
  if (state.steps[state.currentStep] === localStorageKey) {
    return (
      <motion.div
        key={localStorageKey}
        className="h-full"
        custom={state.direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={1}
        onDragEnd={(e, { offset, velocity }) => {
          const swipe = swipePower(offset.x, velocity.x);
          if (swipe < -swipeConfidenceThreshold) {
            dispatch({ type: 'next_step' });
          } else if (swipe > swipeConfidenceThreshold) {
            dispatch({ type: 'previous_step' });
          }
        }}
      >
        <div className="bg-primary-700 inset-0 flex h-full flex-col items-center justify-center overflow-y-auto">
          <div className="flex-1">{children}</div>
          <p className="text-white">
            {state.currentStep + 1} of {state.steps.length}
          </p>
        </div>
      </motion.div>
    );
  }
  return null;
};
