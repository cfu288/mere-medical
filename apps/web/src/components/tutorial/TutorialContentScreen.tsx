import React, { PropsWithChildren } from 'react';
import { TutorialAction } from './TutorialOverlay';

export function TutorialContentScreen({
  dispatch,
  children,
}: PropsWithChildren<{
  dispatch: React.Dispatch<TutorialAction>;
}>) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-white">
      <div className="mx-auto mb-24 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl flex-col items-center justify-center">
          {children}
        </div>
      </div>
      <button
        className="bg-primary-500 hover:bg-primary-600 rounded py-2 px-4 font-bold text-white"
        onClick={() => dispatch({ type: 'next_step' })}
      >
        Next
      </button>
      <button
        className="hover:bg-primary-600 mt-2 rounded py-2 px-4 font-bold text-white"
        onClick={() => {
          dispatch({ type: 'complete_tutorial' });
        }}
      >
        Skip Tutorial
      </button>
    </div>
  );
}
