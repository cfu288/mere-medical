import { TutorialLocalStorageKeys } from '../TutorialConfigProvider';
import React, { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';
import {
  ValueOf,
  TutorialState,
  TutorialAction,
  swipePower,
  swipeConfidenceThreshold,
} from '../TutorialOverlay';

const variants = {
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

export const TutorialItemWrapper = ({
  localStorageKey,
  children,
  state,
  dispatch,
}: PropsWithChildren<{
  localStorageKey?: ValueOf<typeof TutorialLocalStorageKeys>;
  state: TutorialState;
  dispatch: React.Dispatch<TutorialAction>;
}>) => {
  if (state.steps[state.currentStep] === localStorageKey) {
    return (
      <motion.div
        key={localStorageKey}
        className="flex flex-1 flex-col"
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
        <div className="bg-primary-700 inset-0 flex flex-1 flex-col items-center justify-center overflow-y-auto">
          {children}
        </div>
      </motion.div>
    );
  }
  return null;
};
